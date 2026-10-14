# Olx Monitor OP

Extensão de navegador open source que vigia as buscas que você salvou na OLX e joga na sua tela, na hora, o anúncio novo que vale a pena. Também avisa no celular, de graça.

> **Status:** em construção. A primeira versão ainda não foi publicada.

## O que ele vai fazer

- Monitorar as suas buscas da OLX (você cola a URL da busca já filtrada).
- Avisar só anúncio **novo** que passa nos seus filtros de preço e palavras.
- Mostrar o quanto o preço está abaixo da média daquela busca.
- Alertar quando o preço for bom demais pra ser verdade (possível golpe).
- Abrir um alerta "COMPRA AGORA" na frente da tela.
- Mandar push pro celular via [ntfy](https://ntfy.sh) ou bot do Telegram.

## Privacidade

Tudo roda no seu navegador. Não existe servidor do projeto, conta, telemetria ou coleta de dados. Detalhes em [PRIVACY.md](PRIVACY.md).

## Aviso

Projeto pessoal e independente. **Não é afiliado, patrocinado ou aprovado pela OLX.** "OLX" é marca de seus respectivos donos e aparece aqui só para descrever com qual site a extensão funciona.

Use com bom senso: o intervalo mínimo entre verificações é de 5 minutos por busca, a extensão só lê a primeira página das buscas que você configurou e não tenta contornar nenhuma proteção do site. Você é responsável pelo uso que faz da ferramenta e por respeitar os termos de uso da OLX.

## Contribuindo

Este repositório tem uma trava contra vazamento de dado pessoal e segredo. Depois de clonar, ative uma vez:

```bash
git config core.hooksPath .githooks
```

A partir daí, todo commit passa pelo `scripts/public-guard.mjs` (precisa de Node 18+). Ele bloqueia e-mail, telefone, IP, caminho local, tokens, chaves, arquivos `.env`, bancos locais e logs. O mesmo check roda no GitHub Actions a cada push.

Para checar termos pessoais seus (nome, usuário, etc.), copie `.public-guard.local.example` para `.public-guard.local` e liste um termo por linha. Esse arquivo nunca sobe.

## Licença

[MIT](LICENSE)
