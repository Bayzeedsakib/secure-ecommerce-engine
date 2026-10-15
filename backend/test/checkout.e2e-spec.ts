import request from 'supertest';
import type { App } from 'supertest/types.js';
import { VALID_SIGNATURE } from './support/fake-payment-gateway.js';
import {
  createAdmin,
  createProduct,
  createTestApp,
  registerUser,
  resetDatabase,
  type TestContext,
} from './support/test-app.js';

async function addToCart(
  http: App,
  auth: string,
  productId: string,
  quantity: number,
) {
  const res = await request(http)
    .put(`/api/cart/items/${productId}`)
    .set('Authorization', auth)
    .send({ quantity });
  expect(res.status).toBe(200);
}

describe('checkout and inventory', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const stockOf = async (id: string) =>
    (await ctx.prisma.product.findUniqueOrThrow({ where: { id } })).stock;

  async function startCheckout(auth: string) {
    const res = await request(ctx.http)
      .post('/api/checkout')
      .set('Authorization', auth);
    expect(res.status).toBe(201);
    return {
      orderId: res.body.orderId as string,
      sessionId: ctx.payments.lastSessionId(),
    };
  }

  const confirm = (auth: string, sessionId: string) =>
    request(ctx.http)
      .post('/api/checkout/confirm')
      .set('Authorization', auth)
      .send({ sessionId });

  const sendWebhook = (event: unknown, signature = VALID_SIGNATURE) =>
    request(ctx.http)
      .post('/api/webhooks/stripe')
      .set('stripe-signature', signature)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(event));

  it('refuses to check out an empty cart', async () => {
    const { auth } = await registerUser(ctx.http);

    const res = await request(ctx.http)
      .post('/api/checkout')
      .set('Authorization', auth);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Your cart is empty');
  });

  it('creates a pending order with database prices and does not touch stock yet', async () => {
    const { auth, user } = await registerUser(ctx.http);
    const product = await createProduct(ctx.prisma, {
      name: 'Keyboard',
      priceCents: 7499,
      stock: 5,
    });
    await addToCart(ctx.http, auth, product.id, 2);

    const res = await request(ctx.http)
      .post('/api/checkout')
      .set('Authorization', auth);

    expect(res.status).toBe(201);
    expect(res.body.checkoutUrl).toMatch(/^https:\/\/checkout\.stripe\.test\//);

    const order = await ctx.prisma.order.findUniqueOrThrow({
      where: { id: res.body.orderId },
      include: { items: true },
    });
    expect(order.status).toBe('PENDING');
    expect(order.totalCents).toBe(14998);
    expect(order.items).toMatchObject([
      { name: 'Keyboard', priceCents: 7499, quantity: 2 },
    ]);

    const [session] = ctx.payments.createdSessions;
    expect(session).toMatchObject({
      orderId: order.id,
      userId: user.id,
      currency: 'usd',
      items: [{ name: 'Keyboard', unitAmountCents: 7499, quantity: 2 }],
    });
    expect(await stockOf(product.id)).toBe(5);
  });

  it('refuses to check out more than is in stock', async () => {
    const { auth } = await registerUser(ctx.http);
    const product = await createProduct(ctx.prisma, { name: 'Lamp', stock: 3 });
    await addToCart(ctx.http, auth, product.id, 3);
    await ctx.prisma.product.update({
      where: { id: product.id },
      data: { stock: 1 },
    });

    const res = await request(ctx.http)
      .post('/api/checkout')
      .set('Authorization', auth);

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Only 1 of "Lamp" left in stock');
    expect(await ctx.prisma.order.count()).toBe(0);
  });

  it('cancels the order if Stripe cannot start the payment', async () => {
    const { auth } = await registerUser(ctx.http);
    const product = await createProduct(ctx.prisma);
    await addToCart(ctx.http, auth, product.id, 1);
    ctx.payments.failNextCreate = true;

    const res = await request(ctx.http)
      .post('/api/checkout')
      .set('Authorization', auth);

    expect(res.status).toBe(500);
    const [order] = await ctx.prisma.order.findMany();
    expect(order.status).toBe('CANCELLED');
  });

  it('keeps the order pending until Stripe reports the payment', async () => {
    const { auth } = await registerUser(ctx.http);
    const product = await createProduct(ctx.prisma, { stock: 5 });
    await addToCart(ctx.http, auth, product.id, 1);
    const { sessionId } = await startCheckout(auth);

    const res = await confirm(auth, sessionId);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PENDING');
    expect(await stockOf(product.id)).toBe(5);
  });

  it('on payment: marks the order paid, deducts stock and empties the cart', async () => {
    const { auth } = await registerUser(ctx.http);
    const a = await createProduct(ctx.prisma, { name: 'A', stock: 5 });
    const b = await createProduct(ctx.prisma, { name: 'B', stock: 3 });
    await addToCart(ctx.http, auth, a.id, 2);
    await addToCart(ctx.http, auth, b.id, 3);
    const { sessionId } = await startCheckout(auth);

    ctx.payments.pay(sessionId);
    const res = await confirm(auth, sessionId);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PAID');
    expect(res.body.paidAt).toEqual(expect.any(String));
    expect(await stockOf(a.id)).toBe(3);
    expect(await stockOf(b.id)).toBe(0);

    const cart = await request(ctx.http)
      .get('/api/cart')
      .set('Authorization', auth);
    expect(cart.body.items).toEqual([]);
  });

  it('deducts stock only once when the payment is confirmed repeatedly', async () => {
    const { auth } = await registerUser(ctx.http);
    const product = await createProduct(ctx.prisma, { stock: 10 });
    await addToCart(ctx.http, auth, product.id, 4);
    const { sessionId } = await startCheckout(auth);
    const session = ctx.payments.pay(sessionId);

    // Success page, a page refresh and the webhook all arriving together.
    const results = await Promise.all([
      confirm(auth, sessionId),
      confirm(auth, sessionId),
      sendWebhook({ type: 'checkout.session.completed', session }),
    ]);

    expect(results.map((res) => res.status)).toEqual([200, 200, 200]);
    expect(await stockOf(product.id)).toBe(6);
  });

  it('never oversells: when two customers pay for the last unit, one is refunded', async () => {
    const first = await registerUser(ctx.http);
    const second = await registerUser(ctx.http);
    const product = await createProduct(ctx.prisma, {
      name: 'Backpack',
      stock: 1,
    });
    await addToCart(ctx.http, first.auth, product.id, 1);
    await addToCart(ctx.http, second.auth, product.id, 1);
    const firstCheckout = await startCheckout(first.auth);
    const secondCheckout = await startCheckout(second.auth);
    ctx.payments.pay(firstCheckout.sessionId);
    ctx.payments.pay(secondCheckout.sessionId);

    const [a, b] = await Promise.all([
      confirm(first.auth, firstCheckout.sessionId),
      confirm(second.auth, secondCheckout.sessionId),
    ]);

    expect([a.body.status, b.body.status]).toEqual(
      expect.arrayContaining(['PAID', 'REFUNDED']),
    );
    const refunded = a.body.status === 'REFUNDED' ? a.body : b.body;
    expect(refunded.failureReason).toContain('"Backpack" sold out');
    expect(ctx.payments.refunds).toHaveLength(1);
    expect(await stockOf(product.id)).toBe(0);
  });

  it('rolls back every item when one item in the order is sold out', async () => {
    const { auth } = await registerUser(ctx.http);
    const plenty = await createProduct(ctx.prisma, {
      name: 'Plenty',
      stock: 10,
    });
    const scarce = await createProduct(ctx.prisma, {
      name: 'Scarce',
      stock: 1,
    });
    await addToCart(ctx.http, auth, plenty.id, 2);
    await addToCart(ctx.http, auth, scarce.id, 1);
    const { sessionId } = await startCheckout(auth);
    await ctx.prisma.product.update({
      where: { id: scarce.id },
      data: { stock: 0 },
    });

    ctx.payments.pay(sessionId);
    const res = await confirm(auth, sessionId);

    expect(res.body.status).toBe('REFUNDED');
    expect(await stockOf(plenty.id)).toBe(10);
    // The customer keeps their cart so they can adjust it and try again.
    const cart = await request(ctx.http)
      .get('/api/cart')
      .set('Authorization', auth);
    expect(cart.body.items).toHaveLength(2);
  });

  it('cancels a checkout and expires the Stripe session', async () => {
    const { auth } = await registerUser(ctx.http);
    const product = await createProduct(ctx.prisma, { stock: 5 });
    await addToCart(ctx.http, auth, product.id, 1);
    const { orderId, sessionId } = await startCheckout(auth);

    const res = await request(ctx.http)
      .post(`/api/checkout/${orderId}/cancel`)
      .set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
    expect(ctx.payments.sessions.get(sessionId)?.status).toBe('expired');
    expect(await stockOf(product.id)).toBe(5);
  });

  it('does not cancel an order that was already paid', async () => {
    const { auth } = await registerUser(ctx.http);
    const product = await createProduct(ctx.prisma, { stock: 5 });
    await addToCart(ctx.http, auth, product.id, 1);
    const { orderId, sessionId } = await startCheckout(auth);
    ctx.payments.pay(sessionId);

    const res = await request(ctx.http)
      .post(`/api/checkout/${orderId}/cancel`)
      .set('Authorization', auth);

    expect(res.body.status).toBe('PAID');
    expect(await stockOf(product.id)).toBe(4);
  });

  it('picks up a payment when the order list is viewed, even without a webhook', async () => {
    const { auth } = await registerUser(ctx.http);
    const product = await createProduct(ctx.prisma, { stock: 5 });
    await addToCart(ctx.http, auth, product.id, 2);
    const { sessionId } = await startCheckout(auth);
    ctx.payments.pay(sessionId);

    const res = await request(ctx.http)
      .get('/api/orders')
      .set('Authorization', auth);

    expect(res.body[0].status).toBe('PAID');
    expect(await stockOf(product.id)).toBe(3);
  });

  it('shows abandoned and completed checkouts correctly in the admin order list', async () => {
    const { auth } = await registerUser(ctx.http);
    const admin = await createAdmin(ctx.prisma, ctx.http);
    const product = await createProduct(ctx.prisma, { stock: 5 });
    await addToCart(ctx.http, auth, product.id, 1);
    const abandoned = await startCheckout(auth);
    const paid = await startCheckout(auth);
    await ctx.payments.expireCheckoutSession(abandoned.sessionId);
    ctx.payments.pay(paid.sessionId);

    const res = await request(ctx.http)
      .get('/api/admin/orders')
      .set('Authorization', admin.auth);

    const statusOf = (id: string) =>
      res.body.find((order: { id: string }) => order.id === id).status;
    expect(statusOf(abandoned.orderId)).toBe('CANCELLED');
    expect(statusOf(paid.orderId)).toBe('PAID');
    expect(await stockOf(product.id)).toBe(4);
  });

  it("hides other customers' orders", async () => {
    const owner = await registerUser(ctx.http);
    const other = await registerUser(ctx.http);
    const product = await createProduct(ctx.prisma);
    await addToCart(ctx.http, owner.auth, product.id, 1);
    const { orderId, sessionId } = await startCheckout(owner.auth);

    const view = await request(ctx.http)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', other.auth);
    const confirmed = await confirm(other.auth, sessionId);
    const cancelled = await request(ctx.http)
      .post(`/api/checkout/${orderId}/cancel`)
      .set('Authorization', other.auth);

    expect([view.status, confirmed.status, cancelled.status]).toEqual([
      404, 404, 404,
    ]);
  });

  describe('webhook', () => {
    it('rejects requests without a valid signature', async () => {
      const res = await sendWebhook(
        { type: 'checkout.session.completed' },
        'forged',
      );
      expect(res.status).toBe(400);
    });

    it('marks the order paid on checkout.session.completed', async () => {
      const { auth } = await registerUser(ctx.http);
      const product = await createProduct(ctx.prisma, { stock: 5 });
      await addToCart(ctx.http, auth, product.id, 1);
      const { orderId, sessionId } = await startCheckout(auth);
      const session = ctx.payments.pay(sessionId);

      const res = await sendWebhook({
        type: 'checkout.session.completed',
        session,
      });

      expect(res.status).toBe(200);
      const order = await ctx.prisma.order.findUniqueOrThrow({
        where: { id: orderId },
      });
      expect(order.status).toBe('PAID');
      expect(order.stripePaymentIntentId).toBe(`pi_test_${sessionId}`);
      expect(await stockOf(product.id)).toBe(4);
    });

    it('cancels the order on checkout.session.expired', async () => {
      const { auth } = await registerUser(ctx.http);
      const product = await createProduct(ctx.prisma);
      await addToCart(ctx.http, auth, product.id, 1);
      const { orderId, sessionId } = await startCheckout(auth);

      await sendWebhook({
        type: 'checkout.session.expired',
        session: { ...ctx.payments.sessions.get(sessionId), status: 'expired' },
      });

      const order = await ctx.prisma.order.findUniqueOrThrow({
        where: { id: orderId },
      });
      expect(order.status).toBe('CANCELLED');
    });
  });
});
