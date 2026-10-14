// Envio para o celular: ntfy (sem conta) e bot do Telegram (do proprio usuario).

import { brl, pct, place } from "./format.js";

export function headline(alert) {
  const v = alert.deal?.verdict;
  if (v === "suspicious") return "Preço bom demais. Confira antes de pagar.";
  if (v === "great" || v === "good") return `${pct(alert.deal.discount)} abaixo da média`;
  return "Anúncio novo na sua busca";
}

export function plainMessage(alert) {
  const lines = [`${brl(alert.price)}  ${alert.title}`];
  if (alert.deal?.median) lines.push(`Média da busca: ${brl(alert.deal.median)}`);
  const where = place(alert);
  if (where) lines.push(where);
  lines.push(alert.searchName);
  return lines.join("\n");
}

export async function sendNtfy(cfg, alert) {
  const server = (cfg.server || "https://ntfy.sh").replace(/\/+$/, "");
  const great = alert.deal?.verdict === "great";
  const body = {
    topic: cfg.topic,
    title: headline(alert),
    message: plainMessage(alert),
    priority: great ? 5 : 4,
    tags: alert.deal?.verdict === "suspicious" ? ["warning"] : ["moneybag"],
    click: alert.url,
    actions: [{ action: "view", label: "Abrir anúncio", url: alert.url, clear: true }],
  };
  if (alert.image) body.attach = alert.image;
  const res = await fetch(server, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`ntfy respondeu ${res.status}`);
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendTelegram(cfg, alert) {
  const caption = `<b>${esc(headline(alert))}</b>\n${esc(plainMessage(alert))}`;
  const reply_markup = { inline_keyboard: [[{ text: "Abrir anúncio", url: alert.url }]] };
  const base = `https://api.telegram.org/bot${cfg.token}`;
  const payload = alert.image
    ? { method: "sendPhoto", body: { chat_id: cfg.chatId, photo: alert.image, caption, parse_mode: "HTML", reply_markup } }
    : { method: "sendMessage", body: { chat_id: cfg.chatId, text: caption, parse_mode: "HTML", reply_markup } };
  let res = await post(`${base}/${payload.method}`, payload.body);
  if (!res.ok && alert.image) {
    // se a foto falhar, manda so o texto
    res = await post(`${base}/sendMessage`, { chat_id: cfg.chatId, text: caption, parse_mode: "HTML", reply_markup });
  }
  if (!res.ok) throw new Error(`Telegram respondeu ${res.status}`);
}

// Descobre o chat_id: a pessoa manda qualquer mensagem pro bot e a gente le.
export async function findTelegramChat(token) {
  const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
  if (res.status === 401 || res.status === 404) throw new Error("Token inválido. Copie de novo o token que o BotFather mandou.");
  const data = await res.json();
  const msgs = (data.result || []).map((u) => u.message || u.edited_message).filter(Boolean);
  const last = msgs.pop();
  if (!last) throw new Error("Ainda não chegou mensagem. Abra o seu bot no Telegram, mande um oi e tente de novo.");
  return { chatId: String(last.chat.id), name: last.chat.first_name || last.chat.title || "" };
}

function post(url, body) {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
