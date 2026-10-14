import { brl, pct, place, timeAgo } from "../lib/format.js";
import { headline } from "../lib/notify.js";

const $ = (id) => document.getElementById(id);
let queue = [];
let index = 0;
let shownKey = null;

async function load() {
  queue = (await chrome.storage.session.get("queue")).queue || [];
  if (index >= queue.length) index = Math.max(0, queue.length - 1);
  render();
}

function render() {
  const app = $("app");
  const empty = $("vazio");
  if (!queue.length) {
    app.hidden = true;
    empty.hidden = false;
    document.title = "Tudo visto";
    return;
  }
  app.hidden = false;
  empty.hidden = true;

  const a = queue[index];
  const v = a.deal?.verdict || "unknown";
  const suspicious = v === "suspicious";
  app.classList.toggle("suspeito", suspicious);

  $("busca").textContent = a.searchName;
  $("paginacao").hidden = queue.length < 2;
  $("contador").textContent = `${index + 1} de ${queue.length}`;
  $("anterior").disabled = index === 0;
  $("proximo").disabled = index >= queue.length - 1;

  const img = $("imagem");
  img.hidden = !a.image;
  $("sem-foto").hidden = Boolean(a.image);
  if (a.image) {
    img.src = a.image;
    img.onerror = () => {
      img.hidden = true;
      $("sem-foto").hidden = false;
    };
  }
  $("selo-exemplo").hidden = !a.demo;

  $("preco").textContent = brl(a.price);
  const media = $("media");
  media.replaceChildren();
  if (a.deal?.median) {
    media.append("média da busca ");
    const s = document.createElement("s");
    s.textContent = brl(a.deal.median);
    media.append(s);
  } else {
    media.textContent = "ainda aprendendo a média desta busca";
  }

  const chamada = $("chamada");
  chamada.textContent = headline(a);
  $("aviso-golpe").hidden = !suspicious;

  $("titulo").textContent = a.title;
  const when = timeAgo(a.postedAt);
  $("onde").textContent = [place(a), when && `publicado ${when}`].filter(Boolean).join(", ");

  const facts = [];
  if (a.condition) facts.push(a.condition);
  facts.push(a.professional ? "Loja" : "Particular");
  if (a.delivery) facts.push("Entrega pela OLX");
  $("fatos").replaceChildren(
    ...facts.map((f) => {
      const li = document.createElement("li");
      li.textContent = f;
      return li;
    }),
  );

  document.title = `${brl(a.price)}  ${a.title}`;

  // replay da animacao da etiqueta so quando muda o anuncio
  if (shownKey !== a.key) {
    const tag = $("etiqueta");
    tag.style.animation = "none";
    void tag.offsetWidth;
    tag.style.animation = "";
    shownKey = a.key;
  }
}

function current() {
  return queue[index];
}

$("abrir").addEventListener("click", () => {
  const a = current();
  if (!a) return;
  chrome.runtime.sendMessage({ type: "openAd", url: a.url, key: a.key });
});
$("dispensar").addEventListener("click", () => {
  const a = current();
  if (a) chrome.runtime.sendMessage({ type: "dismiss", key: a.key });
});
$("anterior").addEventListener("click", () => {
  index = Math.max(0, index - 1);
  render();
});
$("proximo").addEventListener("click", () => {
  index = Math.min(queue.length - 1, index + 1);
  render();
});
$("fechar").addEventListener("click", () => window.close());

document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") $("anterior").click();
  if (e.key === "ArrowRight") $("proximo").click();
  if (e.key === "Escape") $("dispensar").click();
  if (e.key === "Enter" && document.activeElement === document.body) $("abrir").click();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes.queue) {
    const prevKey = current()?.key;
    queue = changes.queue.newValue || [];
    const fresh = queue.length && queue[0].key !== prevKey && !(changes.queue.oldValue || []).some((q) => q.key === queue[0].key);
    if (fresh) index = 0; // anuncio novo chegou: mostra ele
    else {
      const keep = queue.findIndex((q) => q.key === prevKey);
      index = keep >= 0 ? keep : Math.min(index, Math.max(0, queue.length - 1));
    }
    render();
  }
});

load();
