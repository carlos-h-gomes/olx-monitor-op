# Política de privacidade

**Resumo:** a extensão não coleta nada. Não existe servidor do projeto.

## O que fica no seu navegador

- As buscas que você configurou (link, filtros, intervalo).
- Os anúncios já vistos em cada busca (código e preço), para não repetir alerta e calcular a média.
- Os últimos achados, para mostrar no ícone da extensão.
- Suas configurações de notificação: o tópico do ntfy e, se você usar, o token e o chat do seu bot do Telegram.

Esses dados ficam no armazenamento local da extensão e somem se você desinstalar. Você pode apagar os achados e os anúncios vistos a qualquer momento nas configurações.

## Com quem a extensão conversa

| Destino | Quando | O que é enviado |
|---|---|---|
| olx.com.br | A cada leitura | Acesso às buscas que **você** configurou, como uma visita normal sua |
| img.olx.com.br | Ao mostrar um alerta | Carrega a foto do anúncio |
| ntfy.sh (ou o servidor ntfy que você escolher) | Só se você ativar | Título, preço, cidade, foto e link do anúncio encontrado |
| api.telegram.org | Só se você ativar | Título, preço, cidade, foto e link do anúncio encontrado, para o **seu** bot |

Nenhum dado é enviado para o autor do projeto ou para qualquer outro lugar além dos listados acima.

## Atenção com o ntfy público

No servidor público ntfy.sh, qualquer pessoa que souber o nome do seu tópico consegue ler os alertas. A extensão gera um nome aleatório difícil de adivinhar. Não troque por algo óbvio.
