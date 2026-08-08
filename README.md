# Nexus ERP

Sistema web de controle de estoque multiusuario para uma loja: produtos, movimentacoes de
estoque, fornecedores, alertas de estoque minimo, dashboards e emissao de nota fiscal (NF-e)
integrada via provedor terceirizado.

> Status: em desenvolvimento ativo. Veja o board de progresso abaixo.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Backend | NestJS + TypeScript |
| Banco de dados | PostgreSQL + Prisma ORM |
| Cache / filas | Redis (+ BullMQ para envio assincrono de NF-e) |
| Autenticacao | JWT (access + refresh token) com guards de role (ADMIN / OPERATOR) |
| Emissao fiscal | Adapter plugavel (`FiscalProvider`), sandbox por padrao |
| Infra | Docker Compose (dev), GitHub Actions (CI) |

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

Pre-requisitos: Node 20+, Docker.

```bash
cp apps/api/.env.example apps/api/.env
docker compose up -d postgres redis

npm install --workspace=apps/api
npm run prisma:migrate --workspace=apps/api
npm run prisma:seed --workspace=apps/api    # cria o usuario ADMIN inicial

npm run dev:api    # http://localhost:3333
npm run dev:web    # http://localhost:3000
```

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
uma `StockMovement`, criada e aplicada numa unica transacao (a movimentacao so e
persistida se o novo saldo for valido). `SAIDA` bloqueia estoque insuficiente; `AJUSTE`
aceita um delta positivo ou negativo para correcoes de inventario.

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

## Testes

```bash
npm run test --workspace=apps/api        # unit
npm run test:e2e --workspace=apps/api    # e2e
```

## Qualidade e seguranca

- Validacao de entrada com `class-validator` em todos os DTOs.
- Rate limiting (`@nestjs/throttler`) e headers de seguranca (Helmet) na API.
- Headers de seguranca tambem no Next.js (`X-Frame-Options`, `X-Content-Type-Options`).
- Pipeline de CI roda lint, testes e `npm audit` a cada push.
- Auditoria de acessibilidade (WCAG 2.1 AA) no frontend antes de cada release.

## Roadmap

- [x] Estrutura do monorepo, schema de dados, CI/CD
- [x] Autenticacao e controle de acesso por papel
- [x] Cadastro de produtos e movimentacoes de estoque
- [x] Fornecedores e alertas de estoque minimo
- [ ] Fluxo de venda com emissao fiscal (NF-e)
- [ ] Dashboard com graficos e leitura de codigo de barras/QR
- [ ] Revisao final de qualidade e seguranca

## Licenca

MIT
