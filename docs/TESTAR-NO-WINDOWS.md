# Testar o Nexus ERP no Windows

Passo a passo para rodar o ERP na sua máquina (Windows 10 ou 11) e testar o PDV com leitor
de código de barras, a emissão de NFC-e/NF-e em homologação simulada e o DANFE.

## 1. Instalar o que falta

| Programa | Para quê | Onde baixar |
| --- | --- | --- |
| Node.js 22 LTS | rodar a API e o site | https://nodejs.org (instalador `.msi`) |
| Docker Desktop | subir o Postgres e o Redis sem instalar nada além dele | https://www.docker.com/products/docker-desktop |
| Git | baixar o código | https://git-scm.com/download/win |

O Docker Desktop pede o WSL 2 na primeira vez; aceite e reinicie se ele pedir. Sem Docker,
dá para instalar o PostgreSQL 16 e o Redis (Memurai) nativos, ajustando o
`DATABASE_URL` e o `REDIS_URL` no `.env`.

## 2. Baixar e configurar

Abra o **PowerShell** numa pasta de projetos:

```powershell
git clone https://github.com/Kauaioliveira/Nexus-ERP.git
cd Nexus-ERP
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
```

No `apps/api/.env`, troque `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET` por textos longos
quaisquer. O resto pode ficar como está.

## 3. Subir banco, criar as tabelas e os dados de teste

```powershell
docker compose up -d postgres redis
npm install
npm run prisma:deploy --workspace=apps/api
npm run seed:demo --workspace=apps/api
```

O `seed:demo` cria produtos com NCM e código de barras válidos, clientes (um com CPF e
outro com CNPJ, ambos com endereço), compras, um mês de vendas com NFC-e e uma venda com
NF-e. Logins: `admin@nexuserp.local` e `caixa@nexuserp.local`, senha `TrocarEssaSenha123`
(ou a que estiver em `SEED_ADMIN_PASSWORD` no `.env`).

## 4. Rodar

Em dois terminais:

```powershell
npm run dev:api     # http://localhost:3333
npm run dev:web     # http://localhost:3000
```

Abra http://localhost:3000 e entre como admin.

## 5. Roteiro de teste

### Código de barras

1. **Leitor USB**: ele funciona como teclado. Vá em *Nova venda (PDV)*, deixe o cursor no
   campo de busca e bipe um produto. Ele entra no carrinho na hora. Para vários iguais,
   digite `6*` e bipe (entra com 6 unidades).
2. **Câmera**: no PDV, botão *Câmera*. No notebook/webcam funciona direto em `localhost`.
   No celular o navegador só libera a câmera em HTTPS: rode o site com
   `npm run dev --workspace=apps/web -- --experimental-https -H 0.0.0.0`, abra
   `https://IP-DO-PC:3000` no celular e aceite o aviso de certificado.
3. **Produto que não existe**: bipe um produto real da sua casa. O PDV oferece
   *Cadastrar produto com este código*; o cadastro abre com nome, marca e NCM sugeridos
   (Open Food Facts, ou Cosmos se você colocar um `COSMOS_TOKEN` no `.env` da API).
   Confira, ponha os preços e salve. Volte ao PDV e bipe de novo.
4. *Leitor de código* e *Movimentações* também aceitam o leitor e a câmera.

### NFC-e (consumidor)

1. Faça uma venda no PDV com *Nota fiscal: NFC-e*. Opcional: CPF na nota.
2. A venda abre com a nota *Na fila* e em um ou dois segundos vira *Autorizada*, com
   número, série, chave de acesso e protocolo.
3. *DANFE* abre o cupom de 80 mm com QR Code; *Imprimir DANFE* usa a impressora térmica
   (escolha papel 80 mm, sem margens) ou salva em PDF. *XML* baixa o `procNFCe`.

### NF-e (cliente com endereço)

1. Escolha o cliente *Padaria Fictícia* e *Nota fiscal: NF-e*.
2. O DANFE sai em A4 com o código de barras da chave.
3. Cliente sem CPF/CNPJ ou sem endereço é barrado antes de finalizar.

### Rejeições e falhas (como a SEFAZ responderia)

| Teste | Como provocar | Resultado |
| --- | --- | --- |
| NCM ausente | apague o NCM de um produto e venda | Rejeitada 778, com dica; corrija e use *Reenviar* (mesmo número) |
| CNPJ do emitente inválido | *Empresa e fiscal* > CNPJ `11.222.333/0001-82` e venda | Rejeitada 207; volte o final para `-81` e *Reenviar* |
| Código de barras inválido | mude um dígito do código de barras de um produto e venda | autorizada com `SEM GTIN` no XML (o ERP não manda GTIN inválido) |
| CPF inválido | CPF na nota `111.111.111-11` | o PDV recusa antes de vender |
| SEFAZ fora do ar | *Empresa e fiscal* > *Simular SEFAZ fora do ar* | *Falha de comunicação* (108); desmarque e *Reenviar* |
| Cancelamento | *Cancelar venda* com justificativa de 15+ caracteres | nota *Cancelada* e XML do evento disponível |
| Prazo de cancelamento | tente cancelar uma NFC-e com mais de 30 minutos | recusado (501) e a venda continua ativa |

## O que é simulado

Tudo roda em **homologação** com uma empresa fictícia e sem certificado digital: as notas
não têm valor fiscal, não são assinadas e não vão para a SEFAZ de verdade, então a consulta
pela chave ou pelo QR Code no portal não as encontra. O XML, a chave, o QR Code, a
numeração, as regras de rejeição, os prazos e o DANFE seguem o padrão real. Para emitir de
verdade é preciso certificado A1, credenciamento na SEFAZ e um provedor (Focus NFe,
PlugNotas ou NFe.io) ligado ao `FiscalProvider` da API.

## Problemas comuns

- **`npm run build` do site falha**: confira se não há `NODE_ENV` definido nas variáveis
  de ambiente do Windows (com `NODE_ENV=development` o build do Next quebra).
- **Porta 5432 ocupada**: já existe um PostgreSQL instalado. Pare o serviço dele ou mude a
  porta no `docker-compose.yml` e no `DATABASE_URL`.
- **Nota parada em *Na fila***: o Redis não subiu. Rode `docker compose ps` e, depois de
  subir, use *Reenviar* na venda.
- **Câmera não abre**: o navegador bloqueou a permissão. Clique no cadeado da barra de
  endereço e libere a câmera para `localhost`.
