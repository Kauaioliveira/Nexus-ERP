import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// Cria (ou atualiza) o usuario administrador inicial a partir de variaveis
// de ambiente. Nao ha cadastro publico no sistema; este e o unico jeito de
// obter o primeiro acesso ADMIN, que depois pode criar os demais usuarios
// via POST /v1/users.
async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn(
      'SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD nao definidos - pulando criacao do admin inicial.',
    );
    return;
  }

  const passwordHash = await argon2.hash(password);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: Role.ADMIN, active: true },
    create: {
      email,
      passwordHash,
      name: process.env.SEED_ADMIN_NAME ?? 'Administrador',
      role: Role.ADMIN,
    },
  });

  console.log(`Usuario admin pronto: ${admin.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
