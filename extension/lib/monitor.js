// Decide o que vira alerta a partir dos anuncios lidos de uma busca.
// Funcao pura: recebe o estado e devolve o novo estado, sem tocar no Chrome.

import { rejectReason } from "./filters.js";
import { dealInfo } from "./score.js";

export const SEEN_CAP = 600;

/**
 * @param {object} search   busca configurada
 * @param {object[]} ads    anuncios normalizados (mais recentes primeiro)
 * @param {object} seen     { [adId]: { p: preco, t: visto_em } }
 * @param {object} opts     { now, globalBlocked }
 * @returns {{ seen, alerts, warmedUp, stats }}
 */
export function processAds(search, ads, seen = {}, { now = Date.now(), globalBlocked = [] } = {}) {
  const next = { ...seen };
  const previousPrices = Object.values(seen).map((s) => s.p);
  const alerts = [];
  let fresh = 0;

  // Primeira leitura: so aprende o que ja existe. Sem isso, a pessoa
  // receberia alerta de todos os anuncios antigos de uma vez.
  const warming = !search.warm;

  for (const ad of ads) {
    if (next[ad.id]) {
      next[ad.id] = { ...next[ad.id], p: ad.price ?? next[ad.id].p };
      continue;
    }
    fresh++;
    next[ad.id] = { p: ad.price, t: now };
    if (warming) continue;
    if (rejectReason(ad, search, { globalBlocked, now })) continue;

    alerts.push({
      ...ad,
      key: `${search.id}:${ad.id}`,
      searchId: search.id,
      searchName: search.name,
      deal: dealInfo(ad.price, previousPrices),
      foundAt: now,
    });
  }

  return {
    seen: capSeen(next),
    alerts: rankAlerts(alerts),
    warmedUp: warming,
    stats: { read: ads.length, fresh, known: Object.keys(next).length },
  };
}

// Melhor oferta primeiro; suspeitos vao para o fim, mas continuam aparecendo.
const ORDER = { great: 0, good: 1, normal: 2, unknown: 3, suspicious: 4 };
export function rankAlerts(alerts) {
  return [...alerts].sort((a, b) => {
    const o = ORDER[a.deal.verdict] - ORDER[b.deal.verdict];
    if (o) return o;
    return (b.deal.discount ?? -1) - (a.deal.discount ?? -1);
  });
}

function capSeen(seen) {
  const entries = Object.entries(seen);
  if (entries.length <= SEEN_CAP) return seen;
  entries.sort((a, b) => b[1].t - a[1].t);
  return Object.fromEntries(entries.slice(0, SEEN_CAP));
}
