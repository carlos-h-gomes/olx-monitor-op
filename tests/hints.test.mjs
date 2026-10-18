import test from "node:test";
import assert from "node:assert/strict";
import * as olx from "../extension/lib/sites/olx.js";
import { searchHints } from "../extension/lib/hints.js";

test("sugere as palavras da busca como obrigatorias, sem palavras vazias", () => {
  assert.deepEqual(olx.suggestRequired("https://www.olx.com.br/brasil?q=nintendo%20switch&sf=1"), ["nintendo", "switch"]);
  assert.deepEqual(olx.suggestRequired("https://www.olx.com.br/brasil?q=Placa+de+video+RTX+3090+usada"), ["placa", "video", "rtx", "3090"]);
  assert.deepEqual(olx.suggestRequired("https://www.olx.com.br/brasil?q=9800x3d,%209800x3d"), ["9800x3d"]);
});

test("busca sem texto nao sugere palavra", () => {
  assert.deepEqual(olx.suggestRequired("https://www.olx.com.br/estado-sp/games/consoles-de-video-game"), []);
  assert.deepEqual(olx.suggestRequired("nao e url"), []);
});

test("reconhece busca no Brasil todo", () => {
  assert.equal(olx.isNationwide("https://www.olx.com.br/brasil?q=switch"), true);
  assert.equal(olx.isNationwide("https://www.olx.com.br/games/consoles-de-video-game?q=switch"), true);
  assert.equal(olx.isNationwide("https://www.olx.com.br/estado-sp?q=switch"), false);
  assert.equal(olx.isNationwide("https://www.olx.com.br/estado-sp/sao-paulo-e-regiao/mogi-das-cruzes?q=switch"), false);
  assert.equal(olx.isNationwide("https://sp.olx.com.br/regiao/x"), false);
});

test("avisos da busca: sem palavra obrigatoria e Brasil todo", () => {
  const ids = (s) => searchHints(s, olx).map((h) => h.id);
  assert.deepEqual(ids({ url: "https://www.olx.com.br/brasil?q=switch", required: [] }), ["sem-obrigatoria", "brasil"]);
  assert.deepEqual(ids({ url: "https://www.olx.com.br/estado-sp?q=switch", required: ["switch"] }), []);
  assert.deepEqual(ids({ url: "https://www.olx.com.br/estado-sp?q=switch" }), ["sem-obrigatoria"]);
});

test("palavra sugerida barra o anuncio mal categorizado do caso real", async () => {
  const { rejectReason } = await import("../extension/lib/filters.js");
  const search = { required: olx.suggestRequired("https://www.olx.com.br/brasil?q=nintendo%20switch"), blocked: [] };
  const now = Date.now();
  assert.match(rejectReason({ title: "Capitã marvel Marvel legends", price: 150, postedAt: now }, search, { now }), /sem a palavra/);
  assert.equal(rejectReason({ title: "Nintendo Switch OLED com 2 jogos", price: 650, postedAt: now }, search, { now }), null);
});
