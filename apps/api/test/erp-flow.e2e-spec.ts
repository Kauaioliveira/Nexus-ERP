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
        "categories", "suppliers", "customers", "refresh_tokens", "users" CASCADE`);

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
});
