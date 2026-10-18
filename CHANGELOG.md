# Novidades

O que mudou em cada versão do Olx Monitor OP. A versão mais nova fica no topo.
Para atualizar, baixe o ZIP na [página de releases](https://github.com/carlos-h-gomes/olx-monitor-op/releases) e siga o passo a passo do README.

## 0.2.0 (18/10/2026)

**Menos alerta fora do assunto**
- Ao monitorar uma busca, as palavras dela já entram em "Precisa ter no título". A OLX também mostra anúncios que só citam o produto na categoria ou nos detalhes (por exemplo, um boneco cadastrado como console com modelo "Nintendo Switch"). Com as palavras no título, esse tipo de anúncio não vira mais alerta. Dá para apagar as que você não quiser.
- As buscas mostram um aviso quando estão sem palavra obrigatória ou cobrindo o Brasil todo.

**Achados mais fáceis de limpar**
- Cada achado do ícone da extensão tem um X para tirar da lista.
- O botão **Limpar** remove todos de uma vez, sem precisar ir nas configurações.

Buscas que você já tinha não são alteradas. Se quiser o filtro novo nelas, preencha "Precisa ter no título" nas configurações.

[Todas as mudanças técnicas](https://github.com/carlos-h-gomes/olx-monitor-op/compare/v0.1.0...v0.2.0)

## 0.1.0 (14/10/2026)

Primeira versão pública.

- Monitora o link de uma busca da OLX e avisa só anúncio novo que passe nos seus filtros de preço e de palavras no título.
- Mostra quanto o preço está abaixo da média daquela busca.
- Avisa quando o preço é bom demais para ser verdade (possível golpe).
- Abre o alerta na frente da tela, com foto, preço e botão para o anúncio.
- Manda o alerta para o celular pelo ntfy ou por um bot do Telegram seu.
- Tudo roda no seu navegador, sem servidor do projeto e sem coleta de dados.
