import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/setup-app.js';
import { PaymentGateway } from '../../src/payments/payment-gateway.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { Role } from '../../src/generated/prisma/enums.js';
import { FakePaymentGateway } from './fake-payment-gateway.js';

export interface TestContext {
  app: NestExpressApplication;
  http: App;
  prisma: PrismaService;
  payments: FakePaymentGateway;
}

export async function createTestApp(): Promise<TestContext> {
  const payments = new FakePaymentGateway();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PaymentGateway)
    .useValue(payments)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({
    rawBody: true,
    logger: false,
  });
  setupApp(app);
  await app.init();

  return {
    app,
    http: app.getHttpServer(),
    prisma: app.get(PrismaService),
    payments,
  };
}

export async function resetDatabase(prisma: PrismaService) {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "order_items", "orders", "cart_items", "products", "users" CASCADE',
  );
}

let userCounter = 0;

export async function registerUser(
  http: App,
  overrides: Record<string, string> = {},
) {
  userCounter += 1;
  const credentials = {
    name: `User ${userCounter}`,
    email: `user${userCounter}@example.com`,
    password: 'correct-horse-battery',
    ...overrides,
  };

  const res = await request(http).post('/api/auth/register').send(credentials);
  if (res.status !== 201) {
    throw new Error(
      `Registration failed: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }

  return {
    user: res.body.user as { id: string; email: string },
    credentials,
    auth: `Bearer ${res.body.token}`,
  };
}

// Admins cannot sign up through the API, so tests create them directly.
export async function createAdmin(prisma: PrismaService, http: App) {
  userCounter += 1;
  const email = `admin${userCounter}@example.com`;
  await prisma.user.create({
    data: {
      name: 'Admin',
      email,
      passwordHash: await bcrypt.hash('admin-password', 4),
      role: Role.ADMIN,
    },
  });

  const res = await request(http)
    .post('/api/auth/login')
    .send({ email, password: 'admin-password' });
  return { auth: `Bearer ${res.body.token}` };
}

export function createProduct(
  prisma: PrismaService,
  overrides: Partial<{
    name: string;
    priceCents: number;
    stock: number;
    active: boolean;
  }> = {},
) {
  return prisma.product.create({
    data: { name: 'Test Product', priceCents: 1000, stock: 10, ...overrides },
  });
}
