# Nexus ERP

ERP web multiusuario para lojas: ponto de venda (PDV), clientes, fornecedores, pedidos de
compra, estoque com custo medio, contas a pagar e a receber, fluxo de caixa, relatorios de
margem e emissao de nota fiscal (NF-e) integrada via provedor terceirizado.

> Status: em desenvolvimento ativo. Veja o roadmap no fim do arquivo.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS + Recharts |
| Backend | NestJS 11 + TypeScript |
| Banco de dados | PostgreSQL + Prisma ORM |
| Cache / filas | Redis (+ BullMQ para envio assincrono de NF-e) |
| Autenticacao | JWT (access + refresh token) com guards de role (ADMIN / OPERATOR) |
| Emissao fiscal | Adapter plugavel (`FiscalProvider`), sandbox por padrao |
| Infra | Docker (imagens de api e web), Docker Compose, GitHub Actions (CI) |

## Arquitetura

Monorepo com dois apps independentes que se comunicam via API REST:

```
apps/
  api/    # NestJS - regras de negocio, banco de dados, auth, integracao fiscal
  web/    # Next.js - dashboard, cadastro de produtos, leitura de codigo de barras
```

O acesso a provedores fiscais (NF-e) e feito atras de uma interface `FiscalProvider`,
permitindo trocar de integracao (Focus NFe, PlugNotas, NFe.io) sem alterar o restante do
dominio. Em desenvolvimento, um adapter sandbox simula as respostas do provedor.

## Rodando localmente

Pre-requisitos: Node 22, Docker.

```bash
cp apps/api/.env.example apps/api/.env      # troque os segredos JWT
cp apps/web/.env.example apps/web/.env.local
docker compose up -d postgres redis

npm install                                  # instala api e web (workspaces, lockfile unico)
npm run prisma:deploy --workspace=apps/api   # aplica as migracoes versionadas
npm run prisma:seed --workspace=apps/api     # cria o usuario ADMIN inicial

npm run dev:api    # http://localhost:3333
npm run dev:web    # http://localhost:3000
```

### Dados de demonstracao

```bash
npm run seed:demo --workspace=apps/api
```

Popula o banco com dados **ficticios** (categorias, produtos, fornecedores, clientes,
compras, vendas dos ultimos 30 dias e lancamentos financeiros) passando pelas mesmas regras
de negocio da API. Cria o ADMIN do `.env` e um operador `caixa@nexuserp.local` com a mesma
senha. Recusa rodar com `NODE_ENV=production` e nao faz nada se ja houver vendas.

### Tudo em containers

```bash
cp apps/api/.env.example apps/api/.env
docker compose up -d --build     # postgres, redis, api (aplica migracoes ao subir) e web
```

### Migracoes

O schema evolui por migracoes versionadas em `apps/api/prisma/migrations`. Em
desenvolvimento, `npm run prisma:migrate --workspace=apps/api` cria uma nova migracao a
partir do `schema.prisma`; em producao, a imagem da API roda `prisma migrate deploy` antes
de iniciar.

## Autenticacao

Nao ha cadastro publico. O primeiro acesso (ADMIN) e criado pelo seed a partir de
`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` no `.env`; a partir dele, novos usuarios
(ADMIN ou OPERATOR) sao criados via `POST /v1/users`.

| Endpoint | Acesso | Descricao |
| --- | --- | --- |
| `POST /v1/auth/login` | Publico (rate limited) | Retorna access token (15 min) e refresh token (7 dias) |
| `POST /v1/auth/refresh` | Publico | Rotaciona o refresh token e emite um novo par |
| `POST /v1/auth/logout` | Publico | Revoga um refresh token |
| `GET /v1/auth/me` | Autenticado | Retorna o perfil do usuario logado |
| `POST /v1/users` | ADMIN | Cria um novo usuario |
| `GET /v1/users` | ADMIN | Lista usuarios |
| `PATCH /v1/users/:id` | ADMIN | Altera nome, papel, senha ou desativa (revoga as sessoes do usuario) |

Um ADMIN nao consegue rebaixar nem desativar a si mesmo, e usuarios inativos nao conseguem
renovar a sessao.

Refresh tokens sao opacos (nao sao JWT), armazenados como hash SHA-256 no banco e
rotacionados a cada uso — permitindo revogacao imediata em caso de logout ou comprometimento.

## Produtos e estoque

| Endpoint | Acesso | Descricao |
| --- | --- | --- |
| `POST /v1/categories` | ADMIN | Cria uma categoria |
| `GET /v1/categories` | Autenticado | Lista categorias |
| `POST /v1/products` | ADMIN | Cria um produto (SKU e codigo de barras unicos) |
| `GET /v1/products` | Autenticado | Lista produtos (busca, filtro por categoria/status, paginacao) |
| `GET /v1/products/:id` | Autenticado | Detalha um produto |
| `PATCH /v1/products/:id` | ADMIN | Atualiza um produto |
| `DELETE /v1/products/:id` | ADMIN | Desativa um produto (soft delete, preserva historico) |
| `POST /v1/stock-movements` | Autenticado | Registra ENTRADA / SAIDA / AJUSTE |
| `GET /v1/stock-movements` | Autenticado | Lista movimentacoes (filtro por produto/tipo, paginacao) |
| `GET /v1/products/low-stock` | Autenticado | Produtos ativos com saldo no minimo ou abaixo, do mais critico ao menos critico |

O saldo de estoque (`currentStock`) nunca e editado diretamente: toda alteracao passa por
uma `StockMovement`, criada e aplicada numa unica transacao. A baixa e um `UPDATE`
condicional atomico (`currentStock >= quantidade`), entao duas vendas simultaneas nunca
deixam o saldo negativo. `SAIDA` bloqueia estoque insuficiente; `AJUSTE` aceita um delta
positivo ou negativo para correcoes de inventario.

## Fornecedores

| Endpoint | Acesso | Descricao |
| --- | --- | --- |
| `POST /v1/suppliers` | ADMIN | Cria um fornecedor (documento CNPJ/CPF unico, se informado) |
| `GET /v1/suppliers` | Autenticado | Lista fornecedores (busca, filtro por status, paginacao) |
| `GET /v1/suppliers/:id` | Autenticado | Detalha um fornecedor |
| `PATCH /v1/suppliers/:id` | ADMIN | Atualiza um fornecedor |
| `DELETE /v1/suppliers/:id` | ADMIN | Desativa um fornecedor (soft delete) |

Produtos podem ser vinculados a um fornecedor (`supplierId`); o relatorio de estoque
baixo (`GET /v1/products/low-stock`) ja traz os dados do fornecedor de cada item, para
facilitar a reposicao.

## Clientes

| Endpoint | Acesso | Descricao |
| --- | --- | --- |
| `POST /v1/customers` | Autenticado | Cadastra um cliente (CPF/CNPJ unico, se informado) |
| `GET /v1/customers` | Autenticado | Lista clientes (busca, status, paginacao) |
| `GET /v1/customers/:id` | Autenticado | Detalha o cliente com total comprado e ultimas vendas |
| `PATCH /v1/customers/:id` | Autenticado | Atualiza um cliente |
| `DELETE /v1/customers/:id` | ADMIN | Desativa um cliente |

## Compras

| Endpoint | Acesso | Descricao |
| --- | --- | --- |
| `POST /v1/purchase-orders` | ADMIN | Cria um pedido de compra para um fornecedor |
| `GET /v1/purchase-orders` | Autenticado | Lista pedidos (status, fornecedor, paginacao) |
| `GET /v1/purchase-orders/:id` | Autenticado | Detalha um pedido |
| `POST /v1/purchase-orders/:id/receive` | Autenticado | Recebe a mercadoria |
| `POST /v1/purchase-orders/:id/cancel` | ADMIN | Cancela um pedido ainda nao recebido |

Receber um pedido, numa unica transacao: da entrada no estoque de cada item, recalcula o
custo do produto por **custo medio ponderado** e gera a conta a pagar (a vista ou em
parcelas).

## Vendas e emissao fiscal

| Endpoint | Acesso | Descricao |
| --- | --- | --- |
| `POST /v1/sales` | Autenticado | Registra uma venda (itens, cliente, desconto, forma de pagamento, parcelas) |
| `GET /v1/sales` | Autenticado | Lista vendas (status, cliente, periodo, paginacao) |
| `GET /v1/sales/:id` | Autenticado | Detalha uma venda, incluindo o status da NF-e |
| `POST /v1/sales/:id/cancel` | ADMIN | Cancela a venda com motivo |
| `POST /v1/sales/:id/fiscal/retry` | ADMIN | Reenfileira a emissao da NF-e |

Uma venda e processada numa unica transacao: baixa o estoque de cada item, grava os
`SaleItem` com o preco e o custo do momento (para calcular margem depois), gera o
`FiscalDocument` inicial (`QUEUED`) e as contas a receber. Pagamentos imediatos (dinheiro,
PIX, cartao) geram um recebimento ja pago; boleto e "a prazo" geram parcelas em aberto
(a prazo exige cliente). Valores sao somados em centavos e a diferenca de arredondamento
das parcelas fica na primeira.

Cancelar uma venda devolve o estoque, cancela as parcelas em aberto e lanca um estorno
(conta a pagar) para o que ja tinha sido recebido.

So depois da transacao ser confirmada e que a emissao da NF-e e **enfileirada**
(BullMQ/Redis) — se o Redis estiver fora, a venda e concluida mesmo assim e a NF-e pode
ser reenviada depois. Um worker consome a fila (`fiscal-emission`) e chama o
`FiscalProvider` configurado — hoje um adapter `sandbox` que simula um provedor real
(Focus NFe, PlugNotas, NFe.io) em homologacao. Falhas sao tentadas novamente (3
tentativas, backoff exponencial) e o status fica em `FiscalDocument.status` (`QUEUED` →
`PROCESSING` → `ISSUED` ou `FAILED`). Vendas canceladas nao sao emitidas.

## Financeiro (ADMIN)

| Endpoint | Acesso | Descricao |
| --- | --- | --- |
| `POST /v1/financial-entries` | ADMIN | Lanca conta a pagar ou a receber (com parcelas) |
| `GET /v1/financial-entries` | ADMIN | Lista lancamentos (tipo, status, vencidos, periodo) com total filtrado |
| `GET /v1/financial-entries/summary` | ADMIN | Fluxo de caixa por dia, a receber/pagar em aberto, vencido e proximos 7 dias |
| `GET /v1/financial-entries/:id` | ADMIN | Detalha um lancamento |
| `PATCH /v1/financial-entries/:id` | ADMIN | Edita um lancamento em aberto |
| `POST /v1/financial-entries/:id/pay` | ADMIN | Baixa (paga/recebe) |
| `POST /v1/financial-entries/:id/reopen` | ADMIN | Reabre um lancamento pago |
| `POST /v1/financial-entries/:id/cancel` | ADMIN | Cancela um lancamento |

Vendas e compras alimentam o financeiro automaticamente. Datas de vencimento e relatorios
diarios usam o fuso do negocio (UTC-3).

## Relatorios

`GET /v1/reports/overview?from=&to=` devolve faturamento, ticket medio, vendas por dia,
por forma de pagamento, produtos e clientes que mais compram e estoque baixo. Custo,
lucro bruto e margem so aparecem para ADMIN.

## Frontend (web)

Next.js 16 App Router, com Server Components para leitura de dados e Server Actions para
mutacoes. O access/refresh token ficam em cookies `httpOnly` (nunca acessiveis via JS no
navegador); o `proxy.ts` (antigo `middleware.ts`) protege `/dashboard/*`, redireciona para
`/login` quando necessario e renova o access token antes que ele expire.

| Rota | Descricao |
| --- | --- |
| `/login` | Login |
| `/dashboard` | Visao geral do periodo: faturamento, ticket medio, lucro e margem (ADMIN), grafico de vendas por dia, formas de pagamento, mais vendidos, estoque baixo e contas vencidas |
| `/dashboard/sales/new` | PDV: busca por nome/SKU/codigo de barras, carrinho, desconto, cliente, forma de pagamento e parcelas |
| `/dashboard/sales` e `/[id]` | Vendas com filtros; detalhe com cancelamento, reenvio da NF-e e impressao |
| `/dashboard/customers` | Clientes, com historico de compras |
| `/dashboard/suppliers` | Fornecedores |
| `/dashboard/purchases` | Pedidos de compra e recebimento de mercadoria |
| `/dashboard/finance` | Contas a pagar e a receber, grafico de fluxo de caixa, baixa e estorno (ADMIN) |
| `/dashboard/products` | Produtos com busca e filtros; detalhe com margem e movimentacoes |
| `/dashboard/stock` | Movimentacoes e ajustes de estoque |
| `/dashboard/scan` | Leitor de codigo de barras/QR pela camera, com digitacao manual |
| `/dashboard/users` | Gestao de usuarios (ADMIN) |

Links e dados de custo/margem aparecem apenas para ADMIN; a API faz a mesma checagem, entao
esconder na tela nunca e a unica protecao.

## Testes

```bash
npm run test --workspace=apps/api        # unit
npm run test:e2e --workspace=apps/api    # e2e (precisa de Postgres e Redis; apaga os dados do banco)
```

Os testes e2e percorrem o fluxo completo (cliente → compra → recebimento → venda a prazo →
baixa → cancelamento → relatorio) num banco real. Rode-os num banco descartavel.

## Qualidade e seguranca

- Validacao de entrada com `class-validator` em todos os DTOs (`whitelist` +
  `forbidNonWhitelisted` no `ValidationPipe` global, rejeita campos nao esperados).
- Senhas com hash `argon2`; refresh tokens opacos, hash SHA-256 no banco e rotacionados a
  cada uso.
- Rate limiting global (`@nestjs/throttler`, 100 req/min) com limite mais restrito no login
  (5/min) e headers de seguranca (Helmet) na API.
- Headers de seguranca tambem no Next.js (`X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`); tokens de sessao em cookies `httpOnly` + `sameSite=lax`.
- CI roda typecheck, lint, testes unitarios (com cobertura), migracoes + testes e2e contra
  Postgres/Redis reais, build de api e web, build das imagens Docker e `npm audit` (falha
  com vulnerabilidade alta ou critica em dependencias de producao).
- Dependabot semanal com PRs agrupados (Nest, Next/React, Prisma, lint, minor/patch), para
  que pacotes que precisam subir juntos cheguem num PR so.
- Auditoria de acessibilidade (WCAG 2.1 AA) aplicada ao frontend: labels em todos os campos
  de formulario e filtros (inclusive ocultos visualmente com `sr-only` quando o placeholder
  ja e autoexplicativo), `scope` nas colunas de tabela, `aria-current` na navegacao ativa,
  indicadores de estoque baixo que nao dependem so de cor, resumo em texto (`role="img"` +
  `aria-label`) para os graficos, alternativa de digitacao manual para o leitor de
  codigo (funciona sem camera e por teclado) e navegacao lateral responsiva (nao
  desaparece em telas pequenas).

## Roadmap

- [x] Estrutura do monorepo, schema de dados, CI/CD
- [x] Autenticacao e controle de acesso por papel
- [x] Cadastro de produtos e movimentacoes de estoque
- [x] Fornecedores e alertas de estoque minimo
- [x] Fluxo de venda com emissao fiscal (NF-e)
- [x] Clientes, PDV com formas de pagamento e parcelas, cancelamento de venda
- [x] Pedidos de compra com custo medio ponderado
- [x] Contas a pagar e a receber, fluxo de caixa
- [x] Relatorios de faturamento e margem
- [ ] Adapter real de NF-e (Focus NFe / PlugNotas) e NFC-e para o PDV
- [ ] Caixa (abertura/fechamento e sangria)
- [ ] Inventario com contagem e importacao de produtos por planilha
- [ ] Multiempresa / multiloja
- [ ] Trilha de auditoria

## Licenca

MIT
