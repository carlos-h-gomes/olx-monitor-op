# Olx Monitor OP

Extensão para Chrome e Edge que vigia as suas buscas da OLX e coloca na sua tela, na hora, o anúncio novo que vale a pena. Também avisa no celular, de graça.

![Demonstração: monitorar uma busca, alerta de anúncio abaixo da média e alerta de preço suspeito](docs/demo.gif)

**[Baixar a última versão](https://github.com/carlos-h-gomes/olx-monitor-op/releases/latest)**

Você faz a busca na OLX do jeito que quiser (região, faixa de preço, entrega, condição), clica em **Monitorar esta busca** e pronto. A cada 5 minutos a extensão lê essa busca. Quando aparece um anúncio novo que passa nos seus filtros, abre um alerta com a foto, o preço e quanto ele está abaixo da média daquela busca.

## O que ela faz

- **Monitora o link da sua busca.** Os filtros você aplica na própria OLX. A extensão só acrescenta o que a OLX não filtra: palavras que precisam ou não podem aparecer no título.
- **Avisa só anúncio novo.** Na primeira leitura ela aprende o que já está anunciado. A partir daí, só o que for publicado depois vira alerta.
- **Compara com a média.** Cada busca guarda os preços que já passaram por ela. O alerta mostra "27% abaixo da média" quando for o caso.
- **Desconfia por você.** Preço muito abaixo da média (menos da metade) vira um alerta de cuidado, com dicas contra golpe.
- **Bloqueia o óbvio.** "Defeito", "só caixa", "não liga" e outras já vêm bloqueadas em todas as buscas. Dá para editar.
- **Celular sem custo.** Via [ntfy](https://ntfy.sh) (app aberto, sem conta) ou por um bot do Telegram que é seu.

## Instalação

A extensão não está nas lojas. Você instala direto daqui, leva um minuto.

1. Baixe o arquivo `olx-monitor-op-vX.Y.Z.zip` da [última versão](https://github.com/carlos-h-gomes/olx-monitor-op/releases/latest) e descompacte numa pasta que você não vá apagar.
2. No Chrome, abra `chrome://extensions`. No Edge, `edge://extensions`.
3. Ligue o **Modo do desenvolvedor** (canto superior direito no Chrome, menu lateral no Edge).
4. Clique em **Carregar sem compactação** e escolha a pasta `olx-monitor-op` que saiu do ZIP.
5. Clique no ícone de quebra-cabeça da barra e fixe o **Olx Monitor OP**.

A página de configurações abre sozinha na primeira vez.

### Atualizar

Baixe o ZIP da versão nova, substitua o conteúdo da pasta e clique no botão de recarregar da extensão em `chrome://extensions`. Suas buscas e configurações continuam lá.

## Como usar

1. Abra a [OLX](https://www.olx.com.br), faça a busca e aplique os filtros.
2. Clique no ícone da extensão e em **Monitorar esta busca**.
3. Ajuste, se quiser, o preço máximo e as palavras na página de configurações.
4. Para testar sem esperar, clique em **Ver alerta de exemplo** nas configurações.

O navegador precisa estar aberto para a extensão trabalhar. Se a OLX pedir uma verificação ("confirme que você é humano"), abra o site uma vez nesse navegador e a leitura volta sozinha.

## Alertas no celular

**ntfy:** instale o app ([Android](https://play.google.com/store/apps/details?id=io.heckel.ntfy) ou [iPhone](https://apps.apple.com/app/ntfy/id1625396347)), ligue o ntfy nas configurações e aponte a câmera para o QR code. A extensão gera um tópico aleatório só seu.

**Telegram:** crie um bot no [@BotFather](https://t.me/BotFather), cole o token nas configurações, mande um "oi" para o bot e clique em **Conectar**.

## Privacidade

Tudo roda no seu navegador. Não existe servidor do projeto, conta, telemetria ou coleta de dados. Detalhes em [PRIVACY.md](PRIVACY.md).

## Aviso

Projeto pessoal e independente. **Não é afiliado, patrocinado ou aprovado pela OLX.** "OLX" é marca de seus respectivos donos e aparece aqui só para dizer com qual site a extensão funciona.

A extensão lê no máximo uma vez a cada 5 minutos por busca, só a primeira página das buscas que você configurou, e não tenta contornar nenhuma proteção do site. Você é responsável pelo uso que faz dela e por respeitar os termos de uso da OLX.

## Desenvolvimento

Sem build e sem dependências. A pasta `extension` é carregada direto no navegador.

```bash
npm test        # testes do núcleo (Node 18+)
npm run guard   # checa dado pessoal e segredo antes de publicar
```

Para publicar uma versão, suba a `version` do `extension/manifest.json` e envie a tag correspondente (`git tag v0.2.0 && git push --tags`). O GitHub Actions roda os testes, monta o ZIP e cria a release sozinho.

O código que entende a página da OLX fica isolado em `extension/lib/sites/olx.js`. Para suportar outro site, crie um adaptador com a mesma interface e registre em `extension/lib/sites/index.js`.

Este repositório tem uma trava contra vazamento de dado pessoal e segredo. Depois de clonar, ative uma vez:

```bash
git config core.hooksPath .githooks
```

A partir daí, todo commit passa pelo `scripts/public-guard.mjs`. O mesmo check roda no GitHub Actions a cada push. Para checar também termos pessoais seus, copie `.public-guard.local.example` para `.public-guard.local` e liste um termo por linha. Esse arquivo nunca sobe.

## Licença

[MIT](LICENSE). Fontes Big Shoulders Display e Atkinson Hyperlegible sob a [SIL Open Font License](extension/fonts). Gerador de QR code [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator), licença MIT.
