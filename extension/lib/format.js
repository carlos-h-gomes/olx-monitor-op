// Formatacao e parsing de valores em reais e tempo relativo.

export function parsePrice(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value) : null;
  const m = String(value).match(/(\d[\d.]*)(,\d{1,2})?/);
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, ""));
  return Number.isFinite(n) ? n : null;
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function brl(value) {
  return value === null || value === undefined ? "Sem preço" : BRL.format(value).replace(/ /g, " ");
}

export function pct(value) {
  return `${Math.round(value * 100)}%`;
}

export function timeAgo(ts, now = Date.now()) {
  if (!ts) return "";
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return "agora mesmo";
  const m = Math.round(s / 60);
  if (m < 60) return m === 1 ? "há 1 min" : `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? "há 1 hora" : `há ${h} horas`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

export function place(ad) {
  if (ad.city && ad.uf) return `${ad.city}, ${ad.uf}`;
  return ad.city || ad.uf || "";
}

export function splitWords(text) {
  return String(text || "")
    .split(/[,\n]/)
    .map((w) => w.trim())
    .filter(Boolean);
}
