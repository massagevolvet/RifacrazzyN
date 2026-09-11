# blackwhite.recarga

Loja independente de recarga com visual preto e branco, consulta de ID, confirmação de nickname, checkout PIX via Laranjinha, painel de pedidos e entrega manual.

## Hospedagem

Este projeto está preparado para Netlify.

- Publish directory: `public`
- Functions directory: `netlify/functions`
- Pedidos: Netlify Blobs

## Variáveis secretas

Configure na hospedagem, nunca no GitHub:

- `LARANJINHA_API_KEY` — chave secreta da Laranjinha
- `ADMIN_KEY` — senha/chave do painel em `/admin`

A chave da Laranjinha não deve ser colocada em arquivos públicos ou commits.

## Fluxo

ID → confirmar conta → escolher pacote → nome/CPF → PIX → confirmação de pagamento → entrega manual.

Loja independente, não afiliada à Garena.
