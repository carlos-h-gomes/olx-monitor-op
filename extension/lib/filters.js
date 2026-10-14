// Regras que a OLX nao filtra pela URL: palavras no titulo, vendedor e idade.

export const DEFAULT_BLOCKED = [
  "defeito",
  "com defeito",
  "sucata",
  "para retirada de peças",
  "só caixa",
  "somente caixa",
  "apenas caixa",
  "não funciona",
  "não liga",
  "sem vídeo",
  "quebrado",
  "troco",
  "compro",
  "aluguel",
];

export function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function containsWord(haystack, word) {
  const w = normalizeText(word);
  if (!w) return false;
  const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(haystack);
}

// Retorna null quando o anuncio passa, ou o motivo da recusa.
export function rejectReason(ad, search, { globalBlocked = [], now = Date.now() } = {}) {
  if (search.maxPrice != null && (ad.price == null || ad.price > search.maxPrice)) return "acima do preço máximo";
  if (search.minPrice != null && ad.price != null && ad.price < search.minPrice) return "abaixo do preço mínimo";

  const title = normalizeText(ad.title);
  for (const w of search.required || []) {
    if (!containsWord(title, w)) return `sem a palavra "${w}"`;
  }
  for (const w of [...(search.blocked || []), ...globalBlocked]) {
    if (containsWord(title, w)) return `contém "${w}"`;
  }

  if (search.onlyPrivate && ad.professional) return "vendedor profissional";

  const maxAgeMs = (search.maxAgeHours ?? 24) * 3600 * 1000;
  if (ad.postedAt && now - ad.postedAt > maxAgeMs) return "anúncio antigo";

  return null;
}
