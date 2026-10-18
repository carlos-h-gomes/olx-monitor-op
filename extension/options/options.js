import { siteById, siteFor } from "../lib/sites/index.js";
import { searchHints } from "../lib/hints.js";
import { DEFAULT_BLOCKED } from "../lib/filters.js";
import { brl, splitWords, timeAgo } from "../lib/format.js";
import * as store from "../lib/store.js";

const $ = (id) => document.getElementById(id);
const openIds = new Set();

$("versao").textContent = chrome.runtime.getManifest().version;

// Mostra um retorno curto ("Salvo", erro) ao lado do botao.
function flash(node, text, kind = "ok", ms = 2600) {
  node.textContent = text;
  node.className = `salvo ${kind}`;
  clearTimeout(node._t);
  if (ms) node._t = setTimeout(() => (node.textContent = ""), ms);
}

// Botao destrutivo em dois cliques, sem dialogo do navegador.
function twoStep(button, label, confirmLabel, action) {
  button.addEventListener("click", async () => {
    if (!button.classList.contains("confirmar")) {
      button.classList.add("confirmar");
      button.textContent = confirmLabel;
      button._t = setTimeout(() => {
        button.classList.remove("confirmar");
        button.textContent = label;
      }, 4000);
      return;
    }
    clearTimeout(button._t);
    button.classList.remove("confirmar");
    button.textContent = label;
    await action();
  });
}

function toNumber(v) {
  const n = Number(String(v).replace(/\D/g, ""));
  return String(v).trim() && Number.isFinite(n) && n > 0 ? n : null;
}

function statusLine(s) {
  if (!s.active) return { text: "Pausada", error: false };
  if (!s.lastCheck) return { text: "Primeira leitura em instantes", error: false };
  return {
    text: `Lida ${timeAgo(s.lastCheck)}. ${s.statusText || ""}`.trim(),
    error: s.status === "blocked" || s.status === "error",
  };
}

// ---------------------------------------------------------------- buscas

async function renderSearches() {
  const searches = await store.getSearches();
  const box = $("buscas");
  $("sem-buscas").hidden = searches.length > 0;
  box.replaceChildren(...searches.map(searchItem));
  const target = location.hash.slice(1);
  if (target) {
    const d = document.getElementById(target);
    if (d) {
      d.open = true;
      d.classList.add("destaque");
      d.scrollIntoView({ block: "center" });
      history.replaceState(null, "", location.pathname);
    }
  }
}

function fillSummary(node, s) {
  node.classList.toggle("pausada", !s.active);
  node.querySelector(".busca-nome").textContent = s.name;
  node.querySelector(".busca-teto").textContent = s.maxPrice ? `até ${brl(s.maxPrice)}` : "";
  const st = statusLine(s);
  const el = node.querySelector(".busca-status");
  el.textContent = st.text;
  el.classList.toggle("erro", st.error);
  const hints = searchHints(s, siteById(s.site));
  const box = node.querySelector(".busca-avisos");
  box.hidden = !hints.length;
  box.replaceChildren(
    ...hints.map((h) => {
      const tag = document.createElement("span");
      tag.className = "aviso";
      tag.textContent = h.text;
      return tag;
    }),
  );
}

function searchItem(s) {
  const node = $("tpl-busca").content.firstElementChild.cloneNode(true);
  node.id = `busca-${s.id}`;
  node.dataset.id = s.id;
  node.open = openIds.has(s.id);
  node.addEventListener("toggle", () => (node.open ? openIds.add(s.id) : openIds.delete(s.id)));
  fillSummary(node, s);

  const f = node.querySelector("form");
  f.name.value = s.name;
  f.url.value = s.url;
  f.maxPrice.value = s.maxPrice ?? "";
  f.minPrice.value = s.minPrice ?? "";
  f.required.value = (s.required || []).join(", ");
  f.blocked.value = (s.blocked || []).join(", ");
  f.intervalMin.value = String(s.intervalMin ?? store.MIN_INTERVAL);
  f.maxAgeHours.value = String(s.maxAgeHours ?? 24);
  f.onlyPrivate.checked = Boolean(s.onlyPrivate);
  f.active.checked = s.active !== false;
  node.querySelector('[data-acao="abrir"]').href = s.url;
  const feedback = node.querySelector(".busca-acoes .salvo");

  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const site = siteFor(f.url.value);
    if (!site || !site.isSearchUrl(f.url.value)) {
      flash(feedback, "Esse link não é de uma busca da OLX.", "erro", 0);
      f.url.focus();
      return;
    }
    const url = site.normalizeSearchUrl(f.url.value);
    const changedUrl = url !== s.url;
    const updated = {
      ...s,
      name: f.name.value.trim() || s.name,
      url,
      maxPrice: toNumber(f.maxPrice.value),
      minPrice: toNumber(f.minPrice.value),
      required: splitWords(f.required.value),
      blocked: splitWords(f.blocked.value),
      intervalMin: Math.max(store.MIN_INTERVAL, Number(f.intervalMin.value)),
      maxAgeHours: Number(f.maxAgeHours.value),
      onlyPrivate: f.onlyPrivate.checked,
      active: f.active.checked,
    };
    if (changedUrl) {
      // link novo: reaprende do zero para nao alertar o que ja existe
      Object.assign(updated, { warm: false, lastCheck: null, status: "new", statusText: "" });
      await chrome.storage.local.remove(`seen:${s.id}`);
    }
    await store.upsertSearch(updated);
    Object.assign(s, updated);
    f.url.value = url;
    fillSummary(node, s);
    flash(feedback, "Salvo");
  });

  node.querySelector('[data-acao="verificar"]').addEventListener("click", async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    b.textContent = "Verificando…";
    await chrome.runtime.sendMessage({ type: "checkNow", id: s.id });
    b.disabled = false;
    b.textContent = "Verificar agora";
  });

  twoStep(node.querySelector('[data-acao="remover"]'), "Remover busca", "Clique de novo para remover", async () => {
    await store.removeSearch(s.id);
    openIds.delete(s.id);
    node.remove();
    $("sem-buscas").hidden = Boolean($("buscas").children.length);
  });

  return node;
}

$("form-adicionar").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = $("novo-link");
  const err = $("erro-adicionar");
  const raw = input.value.trim();
  const site = siteFor(raw);
  err.hidden = true;
  if (!site || !site.isSearchUrl(raw)) {
    err.textContent = "Cole o link de uma página de busca da OLX, aquela com a lista de anúncios. Link de um anúncio só não serve.";
    err.hidden = false;
    return;
  }
  const url = site.normalizeSearchUrl(raw);
  const all = await store.getSearches();
  if (all.some((s) => s.url === url)) {
    err.textContent = "Essa busca já está na lista.";
    err.hidden = false;
    return;
  }
  const s = store.newSearch({ url, name: site.suggestName(url), site: site.id, required: site.suggestRequired(url) });
  await store.upsertSearch(s);
  input.value = "";
  openIds.add(s.id);
  await renderSearches();
  chrome.runtime.sendMessage({ type: "checkNow", id: s.id });
});

// Atualiza so a linha de status quando o service worker termina uma leitura.
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local" || !changes.searches) return;
  const list = changes.searches.newValue || [];
  const present = new Set([...$("buscas").children].map((n) => n.dataset.id));
  if (list.some((s) => !present.has(s.id)) || list.length !== present.size) {
    await renderSearches();
    return;
  }
  for (const s of list) {
    const node = document.getElementById(`busca-${s.id}`);
    if (node) fillSummary(node, s);
  }
});

// ---------------------------------------------------------------- computador

async function renderComputer(settings) {
  for (const input of document.querySelectorAll("[data-setting]")) {
    input.checked = Boolean(settings[input.dataset.setting]);
    input.onchange = async () => {
      await store.saveSettings({ [input.dataset.setting]: input.checked });
      flash($("salvo-pc"), "Salvo");
    };
  }
}

$("exemplo").addEventListener("click", () => chrome.runtime.sendMessage({ type: "demo" }));

// ---------------------------------------------------------------- ntfy

function cleanTopic(t) {
  return String(t || "").trim().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
}

function drawQr(server, topic) {
  const box = $("ntfy-qr");
  box.replaceChildren();
  if (!topic || typeof qrcode !== "function") return;
  const host = new URL(server || "https://ntfy.sh").host;
  const qr = qrcode(0, "M");
  qr.addData(`ntfy://${host}/${topic}?display=${encodeURIComponent("Olx Monitor")}`);
  qr.make();
  // SVG gerado localmente pela biblioteca, sem dado externo.
  box.insertAdjacentHTML("afterbegin", qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true }));
}

async function renderNtfy(settings) {
  let { enabled, server, topic } = settings.ntfy;
  if (!topic) {
    topic = store.randomTopic();
    await store.saveSettings({ ntfy: { ...settings.ntfy, topic } });
  }
  $("ntfy-ativo").checked = enabled;
  $("canal-ntfy").classList.toggle("ativo", enabled);
  $("ntfy-topico").value = topic;
  $("ntfy-servidor").value = server === "https://ntfy.sh" ? "" : server;
  drawQr(server, topic);
}

function readNtfy() {
  return {
    enabled: $("ntfy-ativo").checked,
    server: ($("ntfy-servidor").value.trim() || "https://ntfy.sh").replace(/\/+$/, ""),
    topic: cleanTopic($("ntfy-topico").value),
  };
}

async function saveNtfy() {
  const cfg = readNtfy();
  if (!cfg.topic) {
    flash($("ntfy-status"), "Escolha um tópico.", "erro", 0);
    return null;
  }
  if (cfg.server !== "https://ntfy.sh") {
    const origin = `${new URL(cfg.server).origin}/*`;
    const ok = await chrome.permissions.request({ origins: [origin] });
    if (!ok) {
      flash($("ntfy-status"), "Sem permissão para acessar esse servidor.", "erro", 0);
      return null;
    }
  }
  await store.saveSettings({ ntfy: cfg });
  $("ntfy-topico").value = cfg.topic;
  $("canal-ntfy").classList.toggle("ativo", cfg.enabled);
  drawQr(cfg.server, cfg.topic);
  return cfg;
}

$("ntfy-topico").addEventListener("input", () => drawQr(readNtfy().server, cleanTopic($("ntfy-topico").value)));
$("ntfy-ativo").addEventListener("change", async () => {
  if (await saveNtfy()) flash($("ntfy-status"), $("ntfy-ativo").checked ? "Ativado" : "Desativado");
});
$("ntfy-salvar").addEventListener("click", async () => {
  if (await saveNtfy()) flash($("ntfy-status"), "Salvo");
});
$("ntfy-novo").addEventListener("click", () => {
  $("ntfy-topico").value = store.randomTopic();
  drawQr(readNtfy().server, $("ntfy-topico").value);
  flash($("ntfy-status"), "Tópico novo gerado. Salve e assine de novo no celular.", "ok", 5000);
});
$("ntfy-copiar").addEventListener("click", async () => {
  await navigator.clipboard.writeText($("ntfy-topico").value);
  flash($("ntfy-status"), "Tópico copiado");
});
$("ntfy-teste").addEventListener("click", async () => {
  if (!(await saveNtfy())) return;
  flash($("ntfy-status"), "Enviando…", "", 0);
  const r = await chrome.runtime.sendMessage({ type: "test", channel: "ntfy" });
  flash($("ntfy-status"), r?.ok ? "Teste enviado. Olhe o celular." : `Não foi: ${r?.error || "erro desconhecido"}`, r?.ok ? "ok" : "erro", r?.ok ? 5000 : 0);
});

// ---------------------------------------------------------------- telegram

async function renderTelegram(settings) {
  const t = settings.telegram;
  $("tg-ativo").checked = t.enabled;
  $("canal-telegram").classList.toggle("ativo", t.enabled);
  $("tg-token").value = t.token;
  $("tg-chat").textContent = t.chatId ? "Conectado" : "";
  $("tg-chat").className = `salvo${t.chatId ? " ok" : ""}`;
}

async function saveTelegram(extra = {}) {
  const current = (await store.getSettings()).telegram;
  const token = $("tg-token").value.trim();
  const next = { ...current, enabled: $("tg-ativo").checked, token, ...extra };
  if (token !== current.token && !extra.chatId) next.chatId = "";
  await store.saveSettings({ telegram: next });
  $("canal-telegram").classList.toggle("ativo", next.enabled);
  return next;
}

$("tg-conectar").addEventListener("click", async () => {
  const token = $("tg-token").value.trim();
  if (!/^\d+:[\w-]{30,}$/.test(token)) {
    flash($("tg-chat"), "Esse token não parece certo. Copie de novo da conversa com o BotFather.", "erro", 0);
    return;
  }
  flash($("tg-chat"), "Procurando sua mensagem…", "", 0);
  const res = await chrome.runtime
    .sendMessage({ type: "tgConnect", token })
    .catch((e) => ({ ok: false, error: e.message }));
  if (!res?.ok) {
    flash($("tg-chat"), res?.error || "Não consegui conectar.", "erro", 0);
    return;
  }
  $("tg-ativo").checked = true;
  await saveTelegram({ chatId: res.chatId });
  flash($("tg-chat"), res.name ? `Conectado com ${res.name}` : "Conectado", "ok", 0);
});
$("tg-ativo").addEventListener("change", async () => {
  await saveTelegram();
  flash($("tg-status"), $("tg-ativo").checked ? "Ativado" : "Desativado");
});
$("tg-salvar").addEventListener("click", async () => {
  await saveTelegram();
  flash($("tg-status"), "Salvo");
});
$("tg-teste").addEventListener("click", async () => {
  const t = await saveTelegram();
  if (!t.chatId) {
    flash($("tg-status"), "Conecte o bot primeiro (passo 3).", "erro", 0);
    return;
  }
  flash($("tg-status"), "Enviando…", "", 0);
  const r = await chrome.runtime.sendMessage({ type: "test", channel: "telegram" });
  flash($("tg-status"), r?.ok ? "Teste enviado. Olhe o Telegram." : `Não foi: ${r?.error || "erro desconhecido"}`, r?.ok ? "ok" : "erro", r?.ok ? 5000 : 0);
});

// ---------------------------------------------------------------- palavras e dados

async function renderWords(settings) {
  $("bloqueadas").value = settings.globalBlocked.join(", ");
}
$("salvar-bloqueadas").addEventListener("click", async () => {
  await store.saveSettings({ globalBlocked: splitWords($("bloqueadas").value) });
  flash($("bloqueadas-status"), "Salvo");
});
$("restaurar-bloqueadas").addEventListener("click", async () => {
  $("bloqueadas").value = DEFAULT_BLOCKED.join(", ");
  await store.saveSettings({ globalBlocked: DEFAULT_BLOCKED });
  flash($("bloqueadas-status"), "Lista padrão restaurada");
});

$("limpar-achados").addEventListener("click", async () => {
  await store.clearFinds();
  await chrome.runtime.sendMessage({ type: "dismissAll" });
  flash($("dados-status"), "Achados limpos");
});
twoStep($("reaprender"), "Esquecer anúncios vistos", "Clique de novo: a média recomeça do zero", async () => {
  const searches = await store.getSearches();
  await chrome.storage.local.remove(searches.map((s) => `seen:${s.id}`));
  await store.saveSearches(searches.map((s) => ({ ...s, warm: false, known: 0, statusText: "Reaprendendo na próxima leitura" })));
  flash($("dados-status"), "Pronto. Cada busca reaprende na próxima leitura.");
});

// ---------------------------------------------------------------- inicio

async function init() {
  const settings = await store.getSettings();
  await Promise.all([renderSearches(), renderComputer(settings), renderNtfy(settings), renderTelegram(settings), renderWords(settings)]);
}
init();
