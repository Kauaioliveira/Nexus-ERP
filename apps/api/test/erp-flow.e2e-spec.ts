import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

// Fluxo completo de um ERP contra um PostgreSQL real (o mesmo do CI):
// compra -> recebimento -> venda a vista e a prazo -> baixa no financeiro
// -> cancelamento -> relatorios. Os dados sao ficticios e o banco e
// limpo no inicio do teste.
describe('Fluxo do ERP (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  let adminToken: string;
  let operatorToken: string;

  const api = () => request(app.getHttpServer());
  const asAdmin = (req: request.Test) => req.set('Authorization', `Bearer ${adminToken}`);
  const asOperator = (req: request.Test) => req.set('Authorization', `Bearer ${operatorToken}`);

  async function login(email: string, password: string): Promise<string> {
    const res = await api().post('/v1/auth/login').send({ email, password }).expect(200);
    return res.body.accessToken;
  }

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE "financial_entries", "fiscal_documents", "sale_items", "sales",
        "purchase_order_items", "purchase_orders", "stock_movements", "products",
        "categories", "suppliers", "customers", "refresh_tokens", "users",
        "company_settings" CASCADE`);

    const passwordHash = await argon2.hash('SenhaTeste123');
    await prisma.user.createMany({
      data: [
        { email: 'admin@teste.local', name: 'Admin', role: Role.ADMIN, passwordHash },
        { email: 'caixa@teste.local', name: 'Caixa', role: Role.OPERATOR, passwordHash },
      ],
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();

    adminToken = await login('admin@teste.local', 'SenhaTeste123');
    operatorToken = await login('caixa@teste.local', 'SenhaTeste123');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  let productId: string;
  let supplierId: string;
  let customerId: string;

  it('cadastra produto, fornecedor e cliente', async () => {
    const product = await asAdmin(api().post('/v1/products'))
      .send({ sku: 'CAF-500', name: 'Cafe 500g', costPrice: 10, salePrice: 20, minStock: 5 })
      .expect(201);
    productId = product.body.id;

    const supplier = await asAdmin(api().post('/v1/suppliers'))
      .send({ name: 'Distribuidora Exemplo' })
      .expect(201);
    supplierId = supplier.body.id;

    // Operador pode cadastrar cliente no caixa.
    const customer = await asOperator(api().post('/v1/customers'))
      .send({ name: 'Cliente Exemplo', phone: '(11) 90000-0000' })
      .expect(201);
    customerId = customer.body.id;
  });

  it('recebe um pedido de compra: entra no estoque, atualiza o custo medio e gera conta a pagar', async () => {
    const order = await asAdmin(api().post('/v1/purchase-orders'))
      .send({ supplierId, items: [{ productId, quantity: 10, unitCost: 12 }] })
      .expect(201);
    expect(order.body.status).toBe('ORDERED');
    expect(Number(order.body.total)).toBe(120);

    // Operador nao cria pedido de compra, mas pode receber a mercadoria.
    await asOperator(api().post('/v1/purchase-orders'))
      .send({ supplierId, items: [{ productId, quantity: 1, unitCost: 1 }] })
      .expect(403);

    const received = await asOperator(api().post(`/v1/purchase-orders/${order.body.id}/receive`))
      .send({ installments: 2, firstDueDate: '2030-01-15' })
      .expect(200);
    expect(received.body.status).toBe('RECEIVED');
    expect(received.body.financialEntries).toHaveLength(2);

    await asOperator(api().post(`/v1/purchase-orders/${order.body.id}/receive`))
      .send({})
      .expect(400);

    const product = await asAdmin(api().get(`/v1/products/${productId}`)).expect(200);
    expect(product.body.currentStock).toBe(10);
    expect(Number(product.body.costPrice)).toBe(12); // estoque era 0: custo = custo da compra
  });

  let pixSaleId: string;
  let creditSaleId: string;

  it('vende a vista (PIX) com desconto e a prazo parcelado', async () => {
    const pix = await asOperator(api().post('/v1/sales'))
      .send({ items: [{ productId, quantity: 2 }], paymentMethod: 'PIX', discount: 5 })
      .expect(201);
    pixSaleId = pix.body.id;
    expect(Number(pix.body.total)).toBe(35);
    expect(pix.body.financialEntries).toEqual([
      expect.objectContaining({ type: 'RECEIVABLE', status: 'PAID', amount: '35' }),
    ]);

    await asOperator(api().post('/v1/sales'))
      .send({ items: [{ productId, quantity: 1 }], paymentMethod: 'A_PRAZO' })
      .expect(400); // a prazo exige cliente

    const credit = await asOperator(api().post('/v1/sales'))
      .send({
        items: [{ productId, quantity: 3 }],
        paymentMethod: 'A_PRAZO',
        customerId,
        installments: 3,
        firstDueDate: '2030-02-10',
      })
      .expect(201);
    creditSaleId = credit.body.id;
    expect(credit.body.financialEntries.map((e: { amount: string }) => e.amount)).toEqual([
      '20',
      '20',
      '20',
    ]);

    await asOperator(api().post('/v1/sales'))
      .send({ items: [{ productId, quantity: 999 }] })
      .expect(400); // estoque insuficiente

    const product = await asAdmin(api().get(`/v1/products/${productId}`)).expect(200);
    expect(product.body.currentStock).toBe(5);
  });

  it('da baixa numa parcela e mostra o fluxo de caixa', async () => {
    await asOperator(api().get('/v1/financial-entries')).expect(403);

    const open = await asAdmin(
      api().get('/v1/financial-entries').query({ type: 'RECEIVABLE', status: 'OPEN' }),
    ).expect(200);
    expect(open.body.total).toBe(3);
    expect(Number(open.body.totalAmount)).toBe(60);

    await asAdmin(api().post(`/v1/financial-entries/${open.body.items[0].id}/pay`))
      .send({ paymentMethod: 'DINHEIRO' })
      .expect(200);

    await asAdmin(api().post('/v1/financial-entries'))
      .send({
        type: 'PAYABLE',
        description: 'Energia',
        amount: 150.5,
        dueDate: '2030-01-05',
        paid: true,
      })
      .expect(201);

    const summary = await asAdmin(api().get('/v1/financial-entries/summary')).expect(200);
    expect(summary.body.cashFlow.received).toBe(55); // 35 (PIX) + 20 (parcela)
    expect(summary.body.cashFlow.paid).toBe(150.5);
    expect(summary.body.cashFlow.balance).toBe(-95.5);
    expect(summary.body.receivables.open.total).toBe(40);
    expect(summary.body.payables.open.total).toBe(120);
  });

  it('cancela a venda a prazo: devolve estoque, cancela o que falta e estorna o que foi pago', async () => {
    await asOperator(api().post(`/v1/sales/${creditSaleId}/cancel`))
      .send({ reason: 'Devolucao' })
      .expect(403);

    const cancelled = await asAdmin(api().post(`/v1/sales/${creditSaleId}/cancel`))
      .send({ reason: 'Devolucao' })
      .expect(200);
    expect(cancelled.body.status).toBe('CANCELLED');

    const statuses = cancelled.body.financialEntries.map(
      (e: { type: string; status: string; amount: string }) => `${e.type}:${e.status}:${e.amount}`,
    );
    expect(statuses.sort()).toEqual(
      [
        'PAYABLE:PAID:20',
        'RECEIVABLE:CANCELLED:20',
        'RECEIVABLE:CANCELLED:20',
        'RECEIVABLE:PAID:20',
      ].sort(),
    );

    await asAdmin(api().post(`/v1/sales/${creditSaleId}/cancel`))
      .send({ reason: 'De novo' })
      .expect(400);

    const product = await asAdmin(api().get(`/v1/products/${productId}`)).expect(200);
    expect(product.body.currentStock).toBe(8);

    const customer = await asAdmin(api().get(`/v1/customers/${customerId}`)).expect(200);
    expect(Number(customer.body.stats.openBalance)).toBe(0);
  });

  it('mostra o painel com lucro so para o ADMIN', async () => {
    const admin = await asAdmin(api().get('/v1/reports/overview')).expect(200);
    expect(admin.body.sales.count).toBe(1); // a venda cancelada nao conta
    expect(admin.body.sales.revenue).toBe(35);
    expect(admin.body.sales.cost).toBe(24); // 2 x custo 12 no momento da venda
    expect(admin.body.sales.grossProfit).toBe(11);
    expect(admin.body.topProducts[0]).toEqual(
      expect.objectContaining({ productId, quantity: 2, revenue: 40 }),
    );
    expect(admin.body.stock.costValue).toBe(96);

    const operator = await asOperator(api().get('/v1/reports/overview')).expect(200);
    expect(operator.body.sales.revenue).toBe(35);
    expect(operator.body.sales.grossProfit).toBeUndefined();
    expect(operator.body.stock.costValue).toBeUndefined();

    const sales = await asOperator(api().get('/v1/sales').query({ status: 'COMPLETED' })).expect(
      200,
    );
    expect(sales.body.items.map((s: { id: string }) => s.id)).toEqual([pixSaleId]);
  });

  describe('documentos fiscais (SEFAZ simulada)', () => {
    let fiscalProductId: string;

    // A emissao e assincrona (fila): espera o status final da nota.
    async function waitFiscal(saleId: string, expected: string[]) {
      for (let attempt = 0; attempt < 50; attempt++) {
        const sale = await asAdmin(api().get(`/v1/sales/${saleId}`)).expect(200);
        if (expected.includes(sale.body.fiscalDocument.status)) return sale.body;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      throw new Error(`Nota da venda ${saleId} nao chegou a ${expected.join('/')}`);
    }

    it('cadastra produto com GTIN e NCM e o identifica pelo codigo de barras', async () => {
      const created = await asAdmin(api().post('/v1/products'))
        .send({
          sku: 'LEI-001',
          barcode: '7891000315507',
          name: 'Leite em po 400g',
          costPrice: 8,
          salePrice: 15,
          ncm: '0402.21.10',
        })
        .expect(201);
      fiscalProductId = created.body.id;
      expect(created.body.ncm).toBe('04022110');

      await asAdmin(api().post('/v1/stock-movements'))
        .send({ productId: fiscalProductId, type: 'ENTRADA', quantity: 20 })
        .expect(201);

      const found = await asOperator(api().get('/v1/products/barcode/7891000315507')).expect(200);
      expect(found.body).toMatchObject({ validGtin: true, product: { id: fiscalProductId } });

      await asAdmin(api().post('/v1/products'))
        .send({ sku: 'X-1', name: 'NCM errado', costPrice: 1, salePrice: 2, ncm: '123' })
        .expect(400);
    });

    let nfceSaleId: string;

    it('emite NFC-e com CPF na nota e entrega o XML autorizado', async () => {
      await asOperator(api().post('/v1/sales'))
        .send({
          items: [{ productId: fiscalProductId, quantity: 1 }],
          buyerDocument: '111.111.111-11',
        })
        .expect(400); // CPF invalido

      const sale = await asOperator(api().post('/v1/sales'))
        .send({
          items: [{ productId: fiscalProductId, quantity: 2 }],
          paymentMethod: 'DINHEIRO',
          buyerDocument: '529.982.247-25',
        })
        .expect(201);
      nfceSaleId = sale.body.id;

      const done = await waitFiscal(nfceSaleId, ['ISSUED', 'REJECTED', 'FAILED']);
      expect(done.fiscalDocument).toMatchObject({
        status: 'ISSUED',
        model: 'NFCE',
        statusCode: 100,
        series: 1,
        number: expect.any(Number),
      });
      expect(done.fiscalDocument.accessKey).toMatch(/^35\d{4}11222333000181650010{6}/);
      expect(done.fiscalDocument.qrCodeUrl).toContain(done.fiscalDocument.accessKey);
      expect(done.fiscalDocument.xml).toBeUndefined(); // XML so no download

      const xml = await asOperator(api().get(`/v1/sales/${nfceSaleId}/fiscal/xml`)).expect(200);
      expect(xml.headers['content-type']).toContain('application/xml');
      expect(xml.text).toContain(`<chNFe>${done.fiscalDocument.accessKey}</chNFe>`);
      expect(xml.text).toContain('<CPF>52998224725</CPF>');
    });

    it('rejeita produto sem NCM e autoriza no reenvio depois de corrigir', async () => {
      const product = await asAdmin(api().post('/v1/products'))
        .send({ sku: 'SEM-NCM', name: 'Produto sem NCM', costPrice: 1, salePrice: 5 })
        .expect(201);
      await asAdmin(api().post('/v1/stock-movements'))
        .send({ productId: product.body.id, type: 'ENTRADA', quantity: 5 })
        .expect(201);

      const sale = await asOperator(api().post('/v1/sales'))
        .send({ items: [{ productId: product.body.id, quantity: 1 }] })
        .expect(201);

      const rejected = await waitFiscal(sale.body.id, ['REJECTED', 'ISSUED', 'FAILED']);
      expect(rejected.fiscalDocument).toMatchObject({ status: 'REJECTED', statusCode: 778 });

      await asAdmin(api().patch(`/v1/products/${product.body.id}`))
        .send({ ncm: '96081000' })
        .expect(200);
      await asAdmin(api().post(`/v1/sales/${sale.body.id}/fiscal/retry`)).expect(200);

      const issued = await waitFiscal(sale.body.id, ['ISSUED', 'REJECTED', 'FAILED']);
      expect(issued.fiscalDocument).toMatchObject({
        status: 'ISSUED',
        number: rejected.fiscalDocument.number,
      });
    });

    it('emite NF-e so para cliente com documento e endereco', async () => {
      const customer = await asOperator(api().post('/v1/customers'))
        .send({ name: 'Empresa Cliente', document: '11.222.333/0001-81' })
        .expect(201);

      await asOperator(api().post('/v1/sales'))
        .send({
          items: [{ productId: fiscalProductId, quantity: 1 }],
          fiscalModel: 'NFE',
          customerId: customer.body.id,
        })
        .expect(400); // sem endereco

      await asOperator(api().patch(`/v1/customers/${customer.body.id}`))
        .send({
          zipCode: '20040-020',
          street: 'Avenida Rio Branco',
          number: '1',
          district: 'Centro',
          city: 'Rio de Janeiro',
          cityCode: '3304557',
          state: 'RJ',
        })
        .expect(200);

      const sale = await asOperator(api().post('/v1/sales'))
        .send({
          items: [{ productId: fiscalProductId, quantity: 1 }],
          fiscalModel: 'NFE',
          customerId: customer.body.id,
        })
        .expect(201);
      const done = await waitFiscal(sale.body.id, ['ISSUED', 'REJECTED', 'FAILED']);
      expect(done.fiscalDocument).toMatchObject({ status: 'ISSUED', model: 'NFE', number: 1 });

      const xml = await asAdmin(api().get(`/v1/sales/${sale.body.id}/fiscal/xml`)).expect(200);
      expect(xml.text).toContain('<mod>55</mod>');
      expect(xml.text).toContain('<idDest>2</idDest>'); // SP -> RJ: operacao interestadual
      expect(xml.text).toContain('<CNPJ>11222333000181</CNPJ>');
    });

    it('cancela a NFC-e dentro do prazo com justificativa de 15 caracteres', async () => {
      await asAdmin(api().post(`/v1/sales/${nfceSaleId}/cancel`))
        .send({ reason: 'Desistiu' })
        .expect(400);
      const stillOpen = await asAdmin(api().get(`/v1/sales/${nfceSaleId}`)).expect(200);
      expect(stillOpen.body.status).toBe('COMPLETED');

      const cancelled = await asAdmin(api().post(`/v1/sales/${nfceSaleId}/cancel`))
        .send({ reason: 'Cliente desistiu da compra no caixa' })
        .expect(200);
      expect(cancelled.body.status).toBe('CANCELLED');
      expect(cancelled.body.fiscalDocument).toMatchObject({ status: 'CANCELLED', statusCode: 135 });

      const event = await asAdmin(api().get(`/v1/sales/${nfceSaleId}/fiscal/cancel-xml`)).expect(
        200,
      );
      expect(event.text).toContain('<tpEvento>110111</tpEvento>');
    });

    it('so o ADMIN ve o token CSC e altera os dados da empresa', async () => {
      const operator = await asOperator(api().get('/v1/company-settings')).expect(200);
      expect(operator.body.cnpj).toBe('11222333000181');
      expect(operator.body.cscToken).toBeUndefined();
      await asOperator(api().patch('/v1/company-settings')).send({ tradeName: 'X' }).expect(403);

      const updated = await asAdmin(api().patch('/v1/company-settings'))
        .send({ tradeName: 'Mercado Teste', cnpj: '11.222.333/0001-81' })
        .expect(200);
      expect(updated.body.tradeName).toBe('Mercado Teste');
    });
  });
});
