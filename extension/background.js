// Service worker: agenda as leituras, decide os alertas e dispara os avisos.

import { siteById } from "./lib/sites/index.js";
import { processAds } from "./lib/monitor.js";
import { brl } from "./lib/format.js";
import { headline, plainMessage, sendNtfy, sendTelegram } from "./lib/notify.js";
import * as store from "./lib/store.js";

const TICK = "tick";
let running = false;

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await chrome.alarms.create(TICK, { periodInMinutes: 1, delayInMinutes: 0.1 });
  if (reason === "install") chrome.runtime.openOptionsPage();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(TICK, { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === TICK) runDue();
});

// ---------------------------------------------------------------- leitura

async function runDue({ force = false, onlyId = null } = {}) {
  if (running) return;
  running = true;
  try {
    const settings = await store.getSettings();
    if (settings.paused && !force) return;
    const searches = await store.getSearches();
    const now = Date.now();
    for (const search of searches) {
      if (onlyId && search.id !== onlyId) continue;
      if (!search.active && !onlyId) continue;
      const due = !search.lastCheck || now - search.lastCheck >= search.intervalMin * 60_000;
      // mesmo no "verificar agora" respeitamos 1 min entre leituras da mesma busca
      const recent = search.lastCheck && now - search.lastCheck < 60_000;
      if (!(force ? !recent : due)) continue;
      await checkSearch(search, settings);
    }
  } finally {
    running = false;
  }
}

async function checkSearch(search, settings) {
  const site = siteById(search.site);
  const now = Date.now();
  const patch = { lastCheck: now };
  try {
    const res = await fetch(search.url, { credentials: "include", cache: "no-store", headers: { Accept: "text/html" } });
    if (res.status === 403 || res.status === 429) throw new site.BlockedError();
    if (!res.ok) throw new Error(`A OLX respondeu ${res.status}.`);
    const ads = site.parseSearchPage(await res.text());

    const seen = await store.getSeen(search.id);
    const result = processAds(search, ads, seen, { now, globalBlocked: settings.globalBlocked });
    await store.saveSeen(search.id, result.seen);

    Object.assign(patch, {
      warm: true,
      lastOk: now,
      known: result.stats.known,
      status: "ok",
      statusText: result.warmedUp
        ? `Pronto. ${result.stats.read} anúncios atuais guardados, só os novos vão avisar.`
        : result.alerts.length
          ? `${result.alerts.length} achado${result.alerts.length > 1 ? "s" : ""} nesta leitura`
          : "Nada novo que passe nos filtros",
    });

    if (result.alerts.length) await deliver(result.alerts, settings);
  } catch (err) {
    const blocked = err?.name === "BlockedError";
    Object.assign(patch, {
      status: blocked ? "blocked" : "error",
      statusText: blocked
        ? "A OLX pediu verificação. Abra olx.com.br neste navegador, confirme que é você e a leitura volta sozinha."
        : err?.message || "Falha na leitura",
    });
  }
  await store.upsertSearch({ ...search, ...patch });
}

// ---------------------------------------------------------------- avisos

async function deliver(alerts, settings) {
  await store.addFinds(alerts);
  if (settings.alertWindow) await enqueue(alerts);
  if (settings.sound) await playChime(alerts[0].deal?.verdict === "suspicious" ? "warn" : "deal");
  if (settings.systemNotification) {
    for (const a of alerts.slice(0, 3)) await systemNotify(a);
  }
  for (const a of alerts) {
    if (settings.ntfy.enabled && settings.ntfy.topic) {
      await sendNtfy(settings.ntfy, a).catch((e) => console.warn("ntfy:", e.message));
    }
    if (settings.telegram.enabled && settings.telegram.token && settings.telegram.chatId) {
      await sendTelegram(settings.telegram, a).catch((e) => console.warn("telegram:", e.message));
    }
  }
}

async function getQueue() {
  return (await chrome.storage.session.get("queue")).queue || [];
}

async function setQueue(queue) {
  await chrome.storage.session.set({ queue });
  await chrome.action.setBadgeText({ text: queue.length ? String(queue.length) : "" });
  await chrome.action.setBadgeBackgroundColor({ color: "#D7261E" });
}

async function enqueue(alerts) {
  const queue = await getQueue();
  const keys = new Set(queue.map((q) => q.key));
  await setQueue([...alerts.filter((a) => !keys.has(a.key)), ...queue].slice(0, 20));
  await showAlertWindow();
}

async function showAlertWindow() {
  const { alertWin } = await chrome.storage.session.get("alertWin");
  if (alertWin) {
    try {
      await chrome.windows.update(alertWin, { focused: true, drawAttention: true });
      return;
    } catch {
      // janela foi fechada
    }
  }
  const width = 420;
  const height = 640;
  let left;
  let top;
  try {
    const w = await chrome.windows.getLastFocused();
    left = Math.max(0, w.left + w.width - width - 24);
    top = Math.max(0, w.top + 72);
  } catch {
    // sem janela aberta: deixa o Chrome posicionar
  }
  const win = await chrome.windows.create({
    url: chrome.runtime.getURL("alert/alert.html"),
    type: "popup",
    focused: true,
    width,
    height,
    left,
    top,
  });
  await chrome.storage.session.set({ alertWin: win.id });
}

chrome.windows.onRemoved.addListener(async (id) => {
  const { alertWin } = await chrome.storage.session.get("alertWin");
  if (alertWin === id) await chrome.storage.session.remove("alertWin");
});

async function systemNotify(alert) {
  await chrome.notifications.create(`ad:${alert.key}`, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon-128.png"),
    title: `${brl(alert.price)}  ${headline(alert)}`,
    message: plainMessage(alert),
    priority: 2,
    requireInteraction: true,
  });
  const { notifUrls = {} } = await chrome.storage.session.get("notifUrls");
  notifUrls[`ad:${alert.key}`] = alert.url;
  await chrome.storage.session.set({ notifUrls });
}

chrome.notifications.onClicked.addListener(async (id) => {
  const { notifUrls = {} } = await chrome.storage.session.get("notifUrls");
  if (notifUrls[id]) await openAd(notifUrls[id]);
  chrome.notifications.clear(id);
});

async function openAd(url) {
  const [win] = await chrome.windows.getAll({ windowTypes: ["normal"] });
  if (win) {
    await chrome.tabs.create({ url, windowId: win.id, active: true });
    await chrome.windows.update(win.id, { focused: true });
  } else {
    await chrome.windows.create({ url, focused: true });
  }
}

async function playChime(kind) {
  try {
    if (!(await chrome.offscreen.hasDocument())) {
      await chrome.offscreen.createDocument({
        url: "offscreen/offscreen.html",
        reasons: ["AUDIO_PLAYBACK"],
        justification: "Toca um aviso sonoro quando aparece um anúncio novo.",
      });
    }
    await chrome.runtime.sendMessage({ target: "offscreen", type: "chime", kind });
  } catch (e) {
    console.warn("som:", e.message);
  }
}

// ---------------------------------------------------------------- mensagens

const DEMO = {
  key: "demo:1",
  id: "demo",
  searchId: "demo",
  searchName: "Exemplo: Ryzen 7 9800X3D",
  title: "Ryzen 7 9800X3D na caixa, nota fiscal, 3 meses de uso",
  price: 1890,
  url: "https://www.olx.com.br/",
  image: null,
  city: "Campinas",
  uf: "SP",
  professional: false,
  delivery: true,
  condition: "Usado",
  demo: true,
  deal: { verdict: "great", median: 2600, discount: (2600 - 1890) / 2600, sample: 34 },
};

const handlers = {
  async checkNow({ id }) {
    await runDue({ force: true, onlyId: id || null });
    return { ok: true };
  },
  async demo() {
    const a = { ...DEMO, foundAt: Date.now(), postedAt: Date.now() - 3 * 60_000 };
    await enqueue([a]);
    const settings = await store.getSettings();
    if (settings.sound) await playChime("deal");
    return { ok: true };
  },
  async test({ channel }) {
    const settings = await store.getSettings();
    const a = { ...DEMO, foundAt: Date.now(), postedAt: Date.now() - 3 * 60_000 };
    if (channel === "ntfy") await sendNtfy(settings.ntfy, a);
    if (channel === "telegram") await sendTelegram(settings.telegram, a);
    return { ok: true };
  },
  async openAd({ url, key }) {
    await openAd(url);
    if (key) await handlers.dismiss({ key });
    return { ok: true };
  },
  async dismiss({ key }) {
    await setQueue((await getQueue()).filter((q) => q.key !== key));
    return { ok: true };
  },
  async dismissAll() {
    await setQueue([]);
    return { ok: true };
  },
};

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.target === "offscreen") return false;
  const fn = handlers[msg?.type];
  if (!fn) return false;
  fn(msg)
    .then(reply)
    .catch((e) => reply({ ok: false, error: e.message }));
  return true;
});
