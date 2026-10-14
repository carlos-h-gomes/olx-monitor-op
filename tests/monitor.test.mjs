import test from "node:test";
import assert from "node:assert/strict";
import { processAds } from "../extension/lib/monitor.js";
import { rejectReason, DEFAULT_BLOCKED } from "../extension/lib/filters.js";
import { dealInfo, median } from "../extension/lib/score.js";
import { parsePrice, brl, timeAgo } from "../extension/lib/format.js";

const now = 1_800_000_000_000;
const ad = (id, price, over = {}) => ({ id: String(id), title: `RTX 3090 ${id}`, price, postedAt: now - 60_000, professional: false, ...over });
const search = (over = {}) => ({ id: "s1", name: "RTX", warm: true, required: [], blocked: [], ...over });

test("primeira leitura so aprende, nao alerta", () => {
  const r = processAds(search({ warm: false }), [ad(1, 100), ad(2, 200)], {}, { now });
  assert.equal(r.alerts.length, 0);
  assert.equal(r.warmedUp, true);
  assert.equal(Object.keys(r.seen).length, 2);
});

test("so anuncio novo vira alerta", () => {
  const first = processAds(search({ warm: false }), [ad(1, 100)], {}, { now });
  const r = processAds(search(), [ad(2, 90), ad(1, 100)], first.seen, { now });
  assert.deepEqual(r.alerts.map((a) => a.id), ["2"]);
  assert.equal(processAds(search(), [ad(2, 90)], r.seen, { now }).alerts.length, 0);
});

test("anuncio que nao passa no filtro nao alerta, mas fica marcado como visto", () => {
  const r = processAds(search({ maxPrice: 50 }), [ad(1, 100)], {}, { now });
  assert.equal(r.alerts.length, 0);
  assert.ok(r.seen["1"]);
});

test("melhor desconto aparece primeiro e suspeito por ultimo", () => {
  const seen = Object.fromEntries([...Array(10)].map((_, i) => [`old${i}`, { p: 1000, t: now }]));
  const r = processAds(search(), [ad("a", 950), ad("b", 300), ad("c", 700)], seen, { now });
  assert.deepEqual(r.alerts.map((a) => a.id), ["c", "a", "b"]);
  assert.equal(r.alerts.at(-1).deal.verdict, "suspicious");
});

test("filtros: palavras, acento, vendedor e idade", () => {
  const s = search({ required: ["3090"], blocked: ["defeito"], onlyPrivate: true });
  assert.equal(rejectReason(ad(1, 10), s, { now }), null);
  assert.match(rejectReason(ad(1, 10, { title: "RTX 3080" }), s, { now }), /3090/);
  assert.match(rejectReason(ad(1, 10, { title: "RTX 3090 com DEFEITO" }), s, { now }), /defeito/);
  assert.match(rejectReason(ad(1, 10, { title: "RTX 3090 não liga" }), search(), { now, globalBlocked: DEFAULT_BLOCKED }), /nao liga/);
  assert.match(rejectReason(ad(1, 10, { professional: true }), s, { now }), /profissional/);
  assert.match(rejectReason(ad(1, 10, { postedAt: now - 48 * 3600e3 }), s, { now }), /antigo/);
});

test("palavra bloqueada nao pega pedaco de outra palavra", () => {
  assert.equal(rejectReason(ad(1, 10, { title: "Ryzen Destroco edition" }), search({ blocked: ["troco"] }), { now }), null);
});

test("score: mediana, desconto e amostra minima", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 3);
  assert.equal(dealInfo(500, [1000, 1000]).verdict, "unknown");
  const d = dealInfo(750, Array(8).fill(1000));
  assert.equal(d.verdict, "great");
  assert.equal(Math.round(d.discount * 100), 25);
  assert.equal(dealInfo(950, Array(8).fill(1000)).verdict, "normal");
  assert.equal(dealInfo(400, Array(8).fill(1000)).verdict, "suspicious");
});

test("formatos brasileiros", () => {
  assert.equal(parsePrice("R$ 2.599"), 2599);
  assert.equal(parsePrice("R$ 1.234,56"), 1234);
  assert.equal(parsePrice(null), null);
  assert.equal(brl(2599), "R$ 2.599");
  assert.equal(timeAgo(now - 3 * 60_000, now), "há 3 min");
});
