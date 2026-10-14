// "Quanto esta abaixo da media": compara o preco com a mediana dos precos ja
// vistos naquela mesma busca. A mediana ignora bem os extremos (kits, caixas).

export const MIN_SAMPLE = 6;
export const SCAM_RATIO = 0.45; // abaixo de 45% da mediana: desconfie
export const GREAT_DISCOUNT = 0.2;
export const GOOD_DISCOUNT = 0.08;

export function median(values) {
  const v = values.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : Math.round((v[mid - 1] + v[mid]) / 2);
}

export function dealInfo(price, previousPrices) {
  const sample = previousPrices.filter((n) => Number.isFinite(n) && n > 0);
  if (price == null || sample.length < MIN_SAMPLE) {
    return { verdict: "unknown", median: null, discount: null, sample: sample.length };
  }
  const med = median(sample);
  const discount = (med - price) / med;
  let verdict = "normal";
  if (price < med * SCAM_RATIO) verdict = "suspicious";
  else if (discount >= GREAT_DISCOUNT) verdict = "great";
  else if (discount >= GOOD_DISCOUNT) verdict = "good";
  return { verdict, median: med, discount, sample: sample.length };
}
