import { siteById, siteFor } from "../lib/sites/index.js";
import { searchHints } from "../lib/hints.js";
import { brl, pct, timeAgo } from "../lib/format.js";
import * as store from "../lib/store.js";

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

let tabSearch = null;

async function render() {
  const [settings, searches, finds] = await Promise.all([store.getSettings(), store.getSearches(), store.getFinds()]);

  $("estado").setAttribute("aria-pressed", String(settings.paused));
  $("estado-texto").textContent = settings.paused ? "Pausado" : "Vigiando";
  $("estado").title = settings.paused ? "Retomar o monitoramento" : "Pausar o monitoramento";

  // aba atual
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const site = tab?.url ? siteFor(tab.url) : null;
  tabSearch = site && site.isSearchUrl(tab.url) ? { site, url: site.normalizeSearchUrl(tab.url) } : null;
  $("esta-busca").hidden = !tabSearch;
  if (tabSearch) {
    const already = searches.some((s) => sameSearch(s.url, tabSearch.url));
    $("esta-nome").textContent = site.suggestName(tab.url);
    $("monitorar").hidden = already;
    $("esta-ja").hidden = !already;
  }

  $("primeiro").hidden = Boolean(tabSearch) || searches.length > 0;

  // buscas
  $("bloco-buscas").hidden = !searches.length;
  $("buscas").replaceChildren(...searches.map(searchRow));

  // achados
  const recent = finds.slice(0, 5);
  $("bloco-achados").hidden = !recent.length;
  $("achados").replaceChildren(...recent.map(findRow));

  $("verificar").hidden = !searches.length;
}

function sameSearch(a, b) {
  const norm = (u) => {
    const x = new URL(u);
    x.searchParams.sort();
    return x.host + x.pathname + x.search;
  };
  try {
    return norm(a) === norm(b);
  } catch {
    return false;
  }
}

function searchRow(s) {
  const li = el("li");
  const b = el("button", `item busca${s.active ? "" : " pausada"}`);
  b.append(el("span", "busca-nome", s.name));
  b.append(el("span", "busca-teto", s.maxPrice ? `até ${brl(s.maxPrice)}` : ""));
  let status;
  if (!s.active) status = "Pausada";
  else if (!s.lastCheck) status = "Primeira leitura em instantes";
  else status = `Lida ${timeAgo(s.lastCheck)}. ${s.statusText || ""}`.trim();
  b.append(el("span", `busca-status${s.status === "blocked" || s.status === "error" ? " erro" : ""}`, status));
  const hints = searchHints(s, siteById(s.site));
  if (hints.length) {
    const row = el("span", "busca-avisos");
    for (const h of hints) {
      const tag = el("span", "aviso", h.short);
      tag.title = h.text;
      row.append(tag);
    }
    b.append(row);
  }
  b.addEventListener("click", () => openOptions(`busca-${s.id}`));
  li.append(b);
  return li;
}

function findRow(f) {
  const li = el("li", "achado-linha");
  const b = el("button", "item achado");
  const img = el("img", "achado-foto");
  img.alt = "";
  if (f.image) img.src = f.image;
  b.append(img);
  const txt = el("span", "achado-texto");
  txt.append(el("span", "achado-titulo", f.title));
  txt.append(el("span", "achado-quando", `${f.searchName}, ${timeAgo(f.foundAt)}`));
  txt.querySelectorAll("span").forEach((s) => (s.style.display = "block"));
  b.append(txt);
  const price = el("span", "achado-preco");
  price.append(el("span", "preco", brl(f.price)));
  const v = f.deal?.verdict;
  if (v === "great" || v === "good") price.append(el("span", "desconto", `-${pct(f.deal.discount)}`));
  if (v === "suspicious") price.append(el("span", "desconto suspeito", "Suspeito"));
  b.append(price);
  b.addEventListener("click", () => chrome.tabs.create({ url: f.url }));
  li.append(b);

  const x = el("button", "achado-remover");
  x.type = "button";
  x.title = "Remover dos achados";
  x.setAttribute("aria-label", `Remover ${f.title} dos achados`);
  x.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  x.addEventListener("click", async () => {
    li.classList.add("saindo");
    await store.removeFind(f.key);
    await chrome.runtime.sendMessage({ type: "dismiss", key: f.key });
  });
  li.append(x);
  return li;
}

function openOptions(hash = "") {
  chrome.tabs.create({ url: chrome.runtime.getURL(`options/options.html${hash ? `#${hash}` : ""}`) });
  window.close();
}

$("estado").addEventListener("click", async () => {
  const s = await store.getSettings();
  await store.saveSettings({ paused: !s.paused });
  render();
});

$("monitorar").addEventListener("click", async () => {
  if (!tabSearch) return;
  const s = store.newSearch({
    url: tabSearch.url,
    name: $("esta-nome").textContent,
    site: tabSearch.site.id,
    required: tabSearch.site.suggestRequired(tabSearch.url),
  });
  await store.upsertSearch(s);
  chrome.runtime.sendMessage({ type: "checkNow", id: s.id });
  openOptions(`busca-${s.id}`);
});

$("verificar").addEventListener("click", async () => {
  const btn = $("verificar");
  btn.disabled = true;
  btn.textContent = "Verificando…";
  await chrome.runtime.sendMessage({ type: "checkNow" });
  btn.textContent = "Verificar agora";
  btn.disabled = false;
  render();
});

$("config").addEventListener("click", () => openOptions());

// Limpar todos os achados em dois cliques, sem dialogo do navegador.
$("limpar-achados").addEventListener("click", async () => {
  const b = $("limpar-achados");
  if (!b.classList.contains("confirmar")) {
    b.classList.add("confirmar");
    b.textContent = "Confirmar";
    b._t = setTimeout(() => {
      b.classList.remove("confirmar");
      b.textContent = "Limpar";
    }, 4000);
    return;
  }
  clearTimeout(b._t);
  b.classList.remove("confirmar");
  b.textContent = "Limpar";
  await store.clearFinds();
  await chrome.runtime.sendMessage({ type: "dismissAll" });
});

chrome.storage.onChanged.addListener(() => render());
render();
