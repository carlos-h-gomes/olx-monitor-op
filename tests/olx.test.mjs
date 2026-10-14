import test from "node:test";
import assert from "node:assert/strict";
import * as olx from "../extension/lib/sites/olx.js";
import { rawAd, rscPage } from "./helpers.mjs";

test("extrai anuncios do payload RSC dividido em varios trechos", () => {
  const ads = olx.parseSearchPage(rscPage([rawAd(1), rawAd(2), { advertisingId: "pub", deviceType: "desktop" }, rawAd(3)]));
  assert.equal(ads.length, 3);
  assert.deepEqual(
    { id: ads[0].id, price: ads[0].price, city: ads[0].city, uf: ads[0].uf, delivery: ads[0].delivery, condition: ads[0].condition },
    { id: "1000000001", price: 1010, city: "Cidade Teste", uf: "SP", delivery: true, condition: "Usado" },
  );
  assert.match(ads[0].image, /\.webp$/);
});

test("aspas e barras no titulo nao quebram o parser", () => {
  const ads = olx.parseSearchPage(rscPage([rawAd(1, { subject: 'Placa "top" [nova] \\ 24GB' })]));
  assert.equal(ads[0].title, 'Placa "top" [nova] \\ 24GB');
});

test("remove anuncios repetidos", () => {
  assert.equal(olx.parseSearchPage(rscPage([rawAd(1), rawAd(1)])).length, 1);
});

test("pagina de bloqueio da Cloudflare vira BlockedError", () => {
  assert.throws(() => olx.parseSearchPage("<html><title>Just a moment...</title></html>"), { name: "BlockedError" });
});

test("pagina sem anuncios gera erro claro", () => {
  assert.throws(() => olx.parseSearchPage("<html><body>nada</body></html>"), /mudado o formato/);
});

test("formato antigo __NEXT_DATA__ continua funcionando", () => {
  const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { ads: [rawAd(7)] } } })}</script>`;
  assert.equal(olx.parseSearchPage(html)[0].id, "1000000007");
});

test("URL: so aceita OLX e forca ordem por mais recentes na primeira pagina", () => {
  assert.equal(olx.matchesUrl("https://www.olx.com.br/informatica?q=rtx"), true);
  assert.equal(olx.matchesUrl("https://olx.com.br.golpe.com/x"), false);
  assert.equal(olx.matchesUrl("http://www.olx.com.br/x"), false);
  const u = new URL(olx.normalizeSearchUrl("https://www.olx.com.br/informatica?q=rtx&o=3&sf=0#x"));
  assert.equal(u.searchParams.get("sf"), "1");
  assert.equal(u.searchParams.get("o"), null);
  assert.equal(u.hash, "");
});

test("URL de anuncio individual nao conta como busca", () => {
  assert.equal(olx.isSearchUrl("https://sp.olx.com.br/regiao/informatica/produto-1534301467"), false);
  assert.equal(olx.isSearchUrl("https://www.olx.com.br/informatica/processadores?q=ryzen"), true);
});

test("sugere nome a partir da busca", () => {
  assert.equal(olx.suggestName("https://www.olx.com.br/informatica?q=rtx%203090"), "Rtx 3090");
  assert.equal(olx.suggestName("https://www.olx.com.br/informatica/memoria-ram"), "Memoria ram");
});
