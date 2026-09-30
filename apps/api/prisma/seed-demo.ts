import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PaymentMethod, PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { CustomersService } from '../src/modules/customers/customers.service';
import { FinancialService } from '../src/modules/financial/financial.service';
import { PurchasesService } from '../src/modules/purchases/purchases.service';
import { SalesService } from '../src/modules/sales/sales.service';

// Popula o banco com dados FICTICIOS para demonstracao e desenvolvimento:
// categorias, produtos, fornecedores, clientes, compras recebidas, vendas
// espalhadas pelos ultimos 30 dias e algumas despesas. Passa pelos mesmos
// services da API, entao estoque, custo medio e financeiro ficam coerentes.
//
// Uso: npm run seed:demo --workspace=apps/api (nunca em producao).

const prisma = new PrismaClient();
const DAY = 86_400_000;

// Gerador pseudoaleatorio com semente fixa: a demo sai sempre igual.
let seed = 42;
function random(): number {
  seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
  return seed / 2 ** 31;
}
const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)];

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed-demo nao roda com NODE_ENV=production.');
  }
  if ((await prisma.sale.count()) > 0) {
    console.log('O banco ja tem vendas; seed de demonstracao ignorado.');
    return;
  }

  const passwordHash = await argon2.hash(process.env.SEED_ADMIN_PASSWORD ?? 'TrocarEssaSenha123');
  const admin = await prisma.user.upsert({
    where: { email: process.env.SEED_ADMIN_EMAIL ?? 'admin@nexuserp.local' },
    update: {},
    create: {
      email: process.env.SEED_ADMIN_EMAIL ?? 'admin@nexuserp.local',
      name: process.env.SEED_ADMIN_NAME ?? 'Administrador',
      role: Role.ADMIN,
      passwordHash,
    },
  });
  await prisma.user.upsert({
    where: { email: 'caixa@nexuserp.local' },
    update: {},
    create: {
      email: 'caixa@nexuserp.local',
      name: 'Operador de Caixa',
      role: Role.OPERATOR,
      passwordHash,
    },
  });

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    await populate(app, admin.id);
  } finally {
    await app.close();
  }
  console.log('Dados de demonstracao criados. Login: admin@nexuserp.local / caixa@nexuserp.local');
}

async function populate(app: INestApplicationContext, adminId: string) {
  const purchases = app.get(PurchasesService);
  const sales = app.get(SalesService);
  const customersService = app.get(CustomersService);
  const financial = app.get(FinancialService);

  const [mercearia, bebidas, limpeza] = await Promise.all(
    ['Mercearia', 'Bebidas', 'Limpeza'].map((name) => prisma.category.create({ data: { name } })),
  );

  const [distribuidora, atacado] = await Promise.all([
    prisma.supplier.create({
      data: {
        name: 'Distribuidora Exemplo Ltda',
        document: '00.000.000/0001-00',
        phone: '(11) 4000-0000',
      },
    }),
    prisma.supplier.create({ data: { name: 'Atacado Modelo', email: 'contato@atacado.example' } }),
  ]);

  const catalog = [
    ['MER-001', 'Arroz 5kg', mercearia.id, distribuidora.id, 22.5, 32.9, 10],
    ['MER-002', 'Feijão carioca 1kg', mercearia.id, distribuidora.id, 6.2, 9.49, 15],
    ['MER-003', 'Café torrado 500g', mercearia.id, distribuidora.id, 12.9, 19.9, 12],
    ['MER-004', 'Açúcar refinado 1kg', mercearia.id, distribuidora.id, 3.8, 5.79, 15],
    ['MER-005', 'Óleo de soja 900ml', mercearia.id, atacado.id, 5.9, 8.99, 12],
    ['BEB-001', 'Refrigerante 2L', bebidas.id, atacado.id, 5.5, 9.99, 20],
    ['BEB-002', 'Suco integral 1L', bebidas.id, atacado.id, 6.8, 11.9, 8],
    ['BEB-003', 'Água mineral 1,5L', bebidas.id, atacado.id, 1.2, 3.5, 24],
    ['LIM-001', 'Detergente 500ml', limpeza.id, atacado.id, 1.9, 3.49, 20],
    ['LIM-002', 'Sabão em pó 1kg', limpeza.id, atacado.id, 9.5, 15.9, 10],
  ] as const;

  const products = [];
  for (const [sku, name, categoryId, supplierId, costPrice, salePrice, minStock] of catalog) {
    products.push(
      await prisma.product.create({
        data: {
          sku,
          barcode: `78900000${String(products.length + 1).padStart(5, '0')}`,
          name,
          unit: 'UN',
          costPrice,
          salePrice,
          minStock,
          categoryId,
          supplierId,
        },
      }),
    );
  }

  // Compras recebidas: abastecem o estoque e geram contas a pagar.
  for (const supplierId of [distribuidora.id, atacado.id]) {
    const items = products
      .filter((product) => product.supplierId === supplierId)
      .map((product) => ({
        productId: product.id,
        quantity: product.minStock * 4,
        unitCost: Number(product.costPrice),
      }));
    const order = await purchases.create({ supplierId, items }, adminId);
    await purchases.receive(order.id, { installments: 2 }, adminId);
  }
  // Um pedido ainda aguardando entrega.
  await purchases.create(
    {
      supplierId: atacado.id,
      items: [{ productId: products[5].id, quantity: 48, unitCost: 5.3 }],
      expectedAt: new Date(Date.now() + 5 * DAY).toISOString(),
    },
    adminId,
  );

  const customers = [];
  for (const [name, phone] of [
    ['Maria Exemplo', '(11) 90000-0001'],
    ['João Modelo', '(11) 90000-0002'],
    ['Padaria Fictícia', '(11) 90000-0003'],
  ]) {
    const customer = await customersService.create({ name, phone });
    if (customer) customers.push(customer);
  }

  // Vendas dos ultimos 30 dias.
  const methods: PaymentMethod[] = [
    PaymentMethod.PIX,
    PaymentMethod.PIX,
    PaymentMethod.DINHEIRO,
    PaymentMethod.CARTAO_DEBITO,
    PaymentMethod.CARTAO_CREDITO,
  ];
  for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
    const salesToday = 1 + Math.floor(random() * 4);
    for (let n = 0; n < salesToday; n++) {
      const lines = new Map<string, number>();
      const itemCount = 1 + Math.floor(random() * 3);
      for (let i = 0; i < itemCount; i++) {
        const product = pick(products);
        lines.set(product.id, (lines.get(product.id) ?? 0) + 1 + Math.floor(random() * 2));
      }
      const onCredit = random() < 0.12;
      const sale = await sales.create(
        {
          items: [...lines].map(([productId, quantity]) => ({ productId, quantity })),
          paymentMethod: onCredit ? PaymentMethod.A_PRAZO : pick(methods),
          customerId: onCredit || random() < 0.3 ? pick(customers).id : undefined,
          installments: onCredit ? 2 : undefined,
        },
        adminId,
      );

      // Joga a venda (e o recebimento a vista) para o dia simulado.
      const when = new Date(Date.now() - daysAgo * DAY - Math.floor(random() * 8) * 3_600_000);
      await prisma.sale.update({ where: { id: sale.id }, data: { createdAt: when } });
      await prisma.stockMovement.updateMany({
        where: { reason: `Venda #${sale.number}` },
        data: { createdAt: when },
      });
      await prisma.financialEntry.updateMany({
        where: { saleId: sale.id, status: 'PAID' },
        data: { paidAt: when, dueDate: when },
      });
    }
  }

  // Despesas fixas do mes.
  const monthDay = (day: number) => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day, 12)).toISOString();
  };
  await financial.create(
    {
      type: 'PAYABLE',
      description: 'Aluguel da loja',
      category: 'Aluguel',
      amount: 2500,
      dueDate: monthDay(5),
      paid: true,
      paymentMethod: PaymentMethod.PIX,
    },
    adminId,
  );
  await financial.create(
    {
      type: 'PAYABLE',
      description: 'Energia elétrica',
      category: 'Energia',
      amount: 380.4,
      dueDate: monthDay(10),
    },
    adminId,
  );
  await financial.create(
    {
      type: 'PAYABLE',
      description: 'Internet',
      category: 'Internet e telefone',
      amount: 129.9,
      dueDate: monthDay(28),
    },
    adminId,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
