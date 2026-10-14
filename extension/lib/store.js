// Acesso ao chrome.storage com valores padrao. Tudo fica local no navegador.

import { DEFAULT_BLOCKED } from "./filters.js";

export const MIN_INTERVAL = 5;

export const DEFAULT_SETTINGS = {
  paused: false,
  alertWindow: true,
  systemNotification: true,
  sound: true,
  globalBlocked: DEFAULT_BLOCKED,
  ntfy: { enabled: false, server: "https://ntfy.sh", topic: "" },
  telegram: { enabled: false, token: "", chatId: "" },
};

const local = () => chrome.storage.local;

export async function getSettings() {
  const { settings } = await local().get("settings");
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    ntfy: { ...DEFAULT_SETTINGS.ntfy, ...settings?.ntfy },
    telegram: { ...DEFAULT_SETTINGS.telegram, ...settings?.telegram },
  };
}

export async function saveSettings(patch) {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await local().set({ settings: next });
  return next;
}

export async function getSearches() {
  const { searches } = await local().get("searches");
  return Array.isArray(searches) ? searches : [];
}

export async function saveSearches(searches) {
  await local().set({ searches });
}

export async function upsertSearch(search) {
  const all = await getSearches();
  const i = all.findIndex((s) => s.id === search.id);
  if (i >= 0) all[i] = { ...all[i], ...search };
  else all.push(search);
  await saveSearches(all);
  return search;
}

export async function removeSearch(id) {
  await saveSearches((await getSearches()).filter((s) => s.id !== id));
  await local().remove(`seen:${id}`);
}

export async function getSeen(id) {
  const key = `seen:${id}`;
  return (await local().get(key))[key] || {};
}

export async function saveSeen(id, seen) {
  await local().set({ [`seen:${id}`]: seen });
}

export async function getFinds() {
  const { finds } = await local().get("finds");
  return Array.isArray(finds) ? finds : [];
}

export async function addFinds(items) {
  const finds = [...items, ...(await getFinds())];
  const unique = [...new Map(finds.map((f) => [f.key, f])).values()].slice(0, 60);
  await local().set({ finds: unique });
}

export async function clearFinds() {
  await local().set({ finds: [] });
}

export function newSearch({ url, name, site }) {
  return {
    id: crypto.randomUUID(),
    site,
    url,
    name,
    active: true,
    warm: false,
    intervalMin: MIN_INTERVAL,
    maxPrice: null,
    minPrice: null,
    required: [],
    blocked: [],
    onlyPrivate: false,
    maxAgeHours: 24,
    createdAt: Date.now(),
    lastCheck: null,
    lastOk: null,
    status: "new",
    statusText: "Aguardando a primeira leitura",
    known: 0,
  };
}

export function randomTopic() {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  const tail = [...bytes].map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 14);
  return `olx-op-${tail}`;
}
