import request from 'supertest';
import {
  createProduct,
  createTestApp,
  registerUser,
  resetDatabase,
  type TestContext,
} from './support/test-app.js';

describe('cart', () => {
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

  it('requires login', async () => {
    const res = await request(ctx.http).get('/api/cart');
    expect(res.status).toBe(401);
  });

  it('adds items, computes totals from database prices and updates quantities', async () => {
    const { auth } = await registerUser(ctx.http);
    const mouse = await createProduct(ctx.prisma, {
      name: 'Mouse',
      priceCents: 2500,
    });
    const lamp = await createProduct(ctx.prisma, {
      name: 'Lamp',
      priceCents: 1000,
    });

    await request(ctx.http)
      .put(`/api/cart/items/${mouse.id}`)
      .set('Authorization', auth)
      .send({ quantity: 2 });
    const res = await request(ctx.http)
      .put(`/api/cart/items/${lamp.id}`)
      .set('Authorization', auth)
      .send({ quantity: 1 });

    expect(res.status).toBe(200);
    expect(res.body.itemCount).toBe(3);
    expect(res.body.subtotalCents).toBe(6000);

    const updated = await request(ctx.http)
      .put(`/api/cart/items/${mouse.id}`)
      .set('Authorization', auth)
      .send({ quantity: 1 });
    expect(updated.body.subtotalCents).toBe(3500);
  });

  it('is persisted: a new login sees the same cart', async () => {
    const { auth, credentials } = await registerUser(ctx.http);
    const product = await createProduct(ctx.prisma);
    await request(ctx.http)
      .put(`/api/cart/items/${product.id}`)
      .set('Authorization', auth)
      .send({ quantity: 3 });

    const login = await request(ctx.http)
      .post('/api/auth/login')
      .send({ email: credentials.email, password: credentials.password });
    const cart = await request(ctx.http)
      .get('/api/cart')
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(cart.body.items).toHaveLength(1);
    expect(cart.body.items[0].quantity).toBe(3);
  });

  it('refuses more than is in stock', async () => {
    const { auth } = await registerUser(ctx.http);
    const product = await createProduct(ctx.prisma, { name: 'Rare', stock: 2 });

    const res = await request(ctx.http)
      .put(`/api/cart/items/${product.id}`)
      .set('Authorization', auth)
      .send({ quantity: 3 });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Only 2 of "Rare" left in stock');
  });

  it('rejects invalid quantities and unknown products', async () => {
    const { auth } = await registerUser(ctx.http);
    const product = await createProduct(ctx.prisma);

    const zero = await request(ctx.http)
      .put(`/api/cart/items/${product.id}`)
      .set('Authorization', auth)
      .send({ quantity: 0 });
    const fraction = await request(ctx.http)
      .put(`/api/cart/items/${product.id}`)
      .set('Authorization', auth)
      .send({ quantity: 1.5 });
    const unknown = await request(ctx.http)
      .put('/api/cart/items/00000000-0000-4000-8000-000000000000')
      .set('Authorization', auth)
      .send({ quantity: 1 });

    expect(zero.status).toBe(400);
    expect(fraction.status).toBe(400);
    expect(unknown.status).toBe(404);
  });

  it('removes single items and clears the cart', async () => {
    const { auth } = await registerUser(ctx.http);
    const a = await createProduct(ctx.prisma, { name: 'A' });
    const b = await createProduct(ctx.prisma, { name: 'B' });
    for (const product of [a, b]) {
      await request(ctx.http)
        .put(`/api/cart/items/${product.id}`)
        .set('Authorization', auth)
        .send({ quantity: 1 });
    }

    const removed = await request(ctx.http)
      .delete(`/api/cart/items/${a.id}`)
      .set('Authorization', auth);
    expect(
      removed.body.items.map(
        (item: { product: { name: string } }) => item.product.name,
      ),
    ).toEqual(['B']);

    const cleared = await request(ctx.http)
      .delete('/api/cart')
      .set('Authorization', auth);
    expect(cleared.body.items).toEqual([]);
  });

  it('merges a guest cart, capping quantities at stock and skipping unavailable products', async () => {
    const { auth } = await registerUser(ctx.http);
    const plenty = await createProduct(ctx.prisma, {
      name: 'Plenty',
      stock: 10,
    });
    const scarce = await createProduct(ctx.prisma, {
      name: 'Scarce',
      stock: 2,
    });
    const hidden = await createProduct(ctx.prisma, {
      name: 'Hidden',
      active: false,
    });
    await request(ctx.http)
      .put(`/api/cart/items/${plenty.id}`)
      .set('Authorization', auth)
      .send({ quantity: 1 });

    const res = await request(ctx.http)
      .post('/api/cart/merge')
      .set('Authorization', auth)
      .send({
        items: [
          { productId: plenty.id, quantity: 2 },
          { productId: scarce.id, quantity: 5 },
          { productId: hidden.id, quantity: 1 },
        ],
      });

    expect(res.status).toBe(201);
    const quantities = Object.fromEntries(
      res.body.items.map(
        (item: { product: { name: string }; quantity: number }) => [
          item.product.name,
          item.quantity,
        ],
      ),
    );
    expect(quantities).toEqual({ Plenty: 3, Scarce: 2 });
  });
});
