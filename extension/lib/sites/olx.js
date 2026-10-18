// Adaptador da OLX.
// A pagina de busca da OLX (Next.js App Router) entrega os anuncios dentro do
// payload RSC: varias chamadas `self.__next_f.push([1,"..."])` no HTML.
// Juntamos essas strings e extraimos o array `"ads":[...]`.

import { parsePrice } from "../format.js";

export const id = "olx";
export const label = "OLX";

const PUSH_RE = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g;

const BLOCK_MARKERS = [
  "attention required! | cloudflare",
  "<title>just a moment",
  "sorry, you have been blocked",
  "cf_chl_opt",
  "you are unable to access olx.com.br",
];

export class BlockedError extends Error {
  constructor(message = "A OLX bloqueou a leitura desta busca.") {
    super(message);
    this.name = "BlockedError";
  }
}

export function matchesUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname === "olx.com.br" || u.hostname.endsWith(".olx.com.br"));
  } catch {
    return false;
  }
}

// So paginas de busca/listagem: anuncio individual termina em "-<id numerico>".
export function isSearchUrl(url) {
  if (!matchesUrl(url)) return false;
  const path = new URL(url).pathname.replace(/\/$/, "");
  if (!path || path === "") return false;
  return !/-\d{6,}$/.test(path);
}

// Garante ordenacao por "mais recentes" (sf=1) e sempre a primeira pagina.
// "sp" (ordenar por preco) tem prioridade sobre "sf" na OLX, entao sai do link:
// com ele, anuncio novo e caro pode nunca aparecer na primeira pagina.
// O "mais barato" e coberto pelo preco maximo e pela comparacao com a media.
export function normalizeSearchUrl(url) {
  const u = new URL(url);
  u.hash = "";
  u.searchParams.delete("o");
  u.searchParams.delete("sp");
  u.searchParams.set("sf", "1");
  return u.toString();
}

export function suggestName(url) {
  try {
    const u = new URL(url);
    const q = u.searchParams.get("q");
    if (q) return capitalize(q.trim());
    const last = u.pathname.split("/").filter(Boolean).pop() || "Busca";
    return capitalize(last.replace(/-/g, " "));
  } catch {
    return "Busca";
  }
}

// Palavras da busca (q=) que fazem sentido exigir no titulo. A OLX tambem
// casa a busca com categoria e atributos do anuncio (ex.: "Modelo: Nintendo
// Switch"), entao sem isso passa anuncio fora do assunto mal categorizado.
const IGNORED_WORDS = new Set([
  "a", "o", "as", "os", "e", "de", "da", "do", "das", "dos", "em", "no", "na",
  "com", "sem", "para", "pra", "por", "um", "uma", "novo", "nova", "usado", "usada",
]);

export function suggestRequired(url) {
  try {
    const q = new URL(url).searchParams.get("q") || "";
    const words = q
      .toLowerCase()
      .split(/[\s,;+]+/)
      .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
      .filter((w) => w.length >= 2 && !IGNORED_WORDS.has(w));
    return [...new Set(words)];
  } catch {
    return [];
  }
}

// Busca sem estado no caminho (ou com /brasil) cobre o pais inteiro.
// Subdominio de estado (ex.: sp.olx.com.br) e link de anuncio, nao de busca.
export function isNationwide(url) {
  try {
    const u = new URL(url);
    if (u.hostname !== "olx.com.br" && u.hostname !== "www.olx.com.br") return false;
    return !u.pathname.split("/").some((part) => /^estado-[a-z]{2}$/i.test(part));
  } catch {
    return false;
  }
}

export function isBlockPage(html) {
  const head = html.slice(0, 20000).toLowerCase();
  return BLOCK_MARKERS.some((m) => head.includes(m));
}

export function extractRscText(html) {
  let text = "";
  PUSH_RE.lastIndex = 0;
  let m;
  while ((m = PUSH_RE.exec(html))) {
    try {
      text += JSON.parse(m[1]);
    } catch {
      // trecho malformado: ignora e segue
    }
  }
  return text;
}

// Le um array JSON a partir de `start` (posicao do "["), respeitando strings.
function readJsonArray(text, start) {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

export function extractRawAds(text) {
  const key = '"ads":[';
  let from = 0;
  while (true) {
    const k = text.indexOf(key, from);
    if (k < 0) return null;
    const raw = readJsonArray(text, k + key.length - 1);
    from = k + key.length;
    if (!raw) continue;
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.some((a) => a && a.subject)) return arr;
    } catch {
      // tenta a proxima ocorrencia
    }
  }
}

// Formato antigo (Pages Router), mantido como reserva.
function extractLegacyAds(html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    const ads = JSON.parse(m[1])?.props?.pageProps?.ads;
    return Array.isArray(ads) ? ads : null;
  } catch {
    return null;
  }
}

export function normalizeAd(raw) {
  if (!raw || !raw.subject || !raw.listId || !raw.url) return null;
  const loc = raw.locationDetails || {};
  const image = raw.images?.[0]?.originalWebp || raw.images?.[0]?.original || null;
  const condition = (raw.properties || []).find((p) => /condition|condicao/i.test(p?.name || ""))?.value || null;
  return {
    id: String(raw.listId),
    title: String(raw.subject).trim(),
    price: parsePrice(raw.priceValue ?? raw.price),
    oldPrice: parsePrice(raw.oldPrice),
    url: raw.url,
    image,
    city: loc.municipality || null,
    uf: loc.uf || null,
    neighbourhood: loc.neighbourhood || null,
    postedAt: Number(raw.date) > 0 ? Number(raw.date) * 1000 : null,
    professional: Boolean(raw.professionalAd),
    delivery: Boolean(raw.olxDelivery?.enabled),
    featured: Boolean(raw.fixedOnTop || raw.isFeatured),
    condition,
  };
}

export function parseSearchPage(html) {
  if (!html || isBlockPage(html)) throw new BlockedError();
  const raw = extractRawAds(extractRscText(html)) || extractLegacyAds(html);
  if (!raw) throw new Error("Não encontrei anúncios nesta página. A OLX pode ter mudado o formato.");
  const seen = new Set();
  const ads = [];
  for (const item of raw) {
    const ad = normalizeAd(item);
    if (!ad || seen.has(ad.id)) continue;
    seen.add(ad.id);
    ads.push(ad);
  }
  return ads;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
