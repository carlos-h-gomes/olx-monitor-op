// Monta uma pagina no formato RSC da OLX, com dados ficticios.
export function rawAd(n, over = {}) {
  return {
    subject: `Produto teste ${n}`,
    priceValue: `R$ ${(1000 + n * 10).toLocaleString("pt-BR")}`,
    oldPrice: null,
    professionalAd: false,
    listId: 1000000000 + n,
    url: `https://sp.olx.com.br/regiao/informatica/produto-teste-${n}-${1000000000 + n}`,
    date: Math.floor(Date.now() / 1000) - 60,
    images: [{ original: `https://img.olx.com.br/images/00/${n}.jpg`, originalWebp: `https://img.olx.com.br/images/00/${n}.webp` }],
    locationDetails: { municipality: "Cidade Teste", uf: "SP", neighbourhood: "Centro" },
    olxDelivery: { enabled: true },
    properties: [{ name: "info_condition", value: "Usado", label: "Condição" }],
    fixedOnTop: false,
    isFeatured: false,
    ...over,
  };
}

export function rscPage(ads) {
  const payload = `1:["$","main",null,{"children":["$","$L24",null,{"ads":${JSON.stringify(ads)},"totalOfAds":${ads.length}}]}]\n`;
  const half = Math.floor(payload.length / 2);
  const chunks = [payload.slice(0, half), payload.slice(half)];
  const scripts = chunks.map((c) => `<script>self.__next_f.push([1,${JSON.stringify(c)}])</script>`).join("\n");
  return `<!doctype html><html><head><title>Busca</title></head><body>${scripts}</body></html>`;
}
