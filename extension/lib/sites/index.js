// Registro de sites suportados. Para adicionar um site novo, crie um
// adaptador com a mesma interface de olx.js e inclua aqui.
import * as olx from "./olx.js";

export const SITES = [olx];

export function siteFor(url) {
  return SITES.find((s) => s.matchesUrl(url)) || null;
}

export function siteById(id) {
  return SITES.find((s) => s.id === id) || null;
}
