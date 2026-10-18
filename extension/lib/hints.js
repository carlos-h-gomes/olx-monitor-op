// Avisos de configuracao de uma busca, mostrados no popup e nas configuracoes.
// Funcao pura: recebe a busca e o adaptador do site.

export function searchHints(search, site) {
  const hints = [];
  if (!(search.required || []).length) {
    hints.push({ id: "sem-obrigatoria", short: "Sem palavra obrigatória", text: "Sem palavra obrigatória no título, pode avisar anúncio fora do assunto." });
  }
  if (site?.isNationwide?.(search.url)) {
    hints.push({ id: "brasil", short: "Brasil todo", text: "Busca no Brasil todo. Filtre a região na OLX se quiser só anúncios perto de você." });
  }
  return hints;
}
