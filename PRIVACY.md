# Política de privacidade

**Resumo:** a extensão não coleta nada. Não existe servidor do projeto.

## O que fica no seu navegador

- As buscas que você configurou (URL, filtros, intervalo).
- A lista de anúncios já vistos, para não repetir alerta e calcular o preço médio.
- Suas configurações de notificação (tópico do ntfy, token do bot do Telegram).

Esses dados ficam no armazenamento local da extensão e somem se você desinstalar.

## Com quem a extensão conversa

| Destino | Quando | O que é enviado |
|---|---|---|
| olx.com.br | A cada verificação | Acesso às URLs de busca que **você** configurou, como uma visita normal |
| ntfy.sh (ou o servidor ntfy que você escolher) | Só se você ativar | Título, preço, local e link do anúncio encontrado |
| api.telegram.org | Só se você ativar | Título, preço, local e link do anúncio encontrado, para o **seu** bot |

Nenhum dado é enviado para o autor do projeto ou para terceiros além dos listados acima.

## Atenção com o ntfy público

No servidor público ntfy.sh, qualquer pessoa que souber o nome do seu tópico consegue ler os alertas. A extensão gera um nome aleatório difícil de adivinhar. Não troque por algo óbvio.
