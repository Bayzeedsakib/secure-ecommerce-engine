import request from 'supertest';
import {
  createAdmin,
  createProduct,
  createTestApp,
  registerUser,
  resetDatabase,
  type TestContext,
} from './support/test-app.js';

describe('products and admin', () => {
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

  it('lists only active products publicly', async () => {
    await createProduct(ctx.prisma, { name: 'Visible' });
    await createProduct(ctx.prisma, { name: 'Archived', active: false });

    const res = await request(ctx.http).get('/api/products');

    expect(res.status).toBe(200);
    expect(res.body.map((product: { name: string }) => product.name)).toEqual([
      'Visible',
    ]);
  });

  it('keeps customers out of admin routes', async () => {
    const { auth } = await registerUser(ctx.http);

    const res = await request(ctx.http)
      .get('/api/admin/products')
      .set('Authorization', auth);

    expect(res.status).toBe(403);
  });

  it('lets an admin create, restock and archive products', async () => {
    const { auth } = await createAdmin(ctx.prisma, ctx.http);
    const customer = await registerUser(ctx.http);

    const created = await request(ctx.http)
      .post('/api/admin/products')
      .set('Authorization', auth)
      .send({
        name: 'Webcam',
        priceCents: 5499,
        stock: 0,
        category: 'Computing',
      });
    expect(created.status).toBe(201);

    const restocked = await request(ctx.http)
      .patch(`/api/admin/products/${created.body.id}`)
      .set('Authorization', auth)
      .send({ stock: 12 });
    expect(restocked.body.stock).toBe(12);

    await request(ctx.http)
      .put(`/api/cart/items/${created.body.id}`)
      .set('Authorization', customer.auth)
      .send({ quantity: 1 });

    const archived = await request(ctx.http)
      .delete(`/api/admin/products/${created.body.id}`)
      .set('Authorization', auth);
    expect(archived.body.active).toBe(false);

    const shop = await request(ctx.http).get('/api/products');
    const cart = await request(ctx.http)
      .get('/api/cart')
      .set('Authorization', customer.auth);
    expect(shop.body).toEqual([]);
    expect(cart.body.items).toEqual([]);
  });

  it('validates product input', async () => {
    const { auth } = await createAdmin(ctx.prisma, ctx.http);

    const res = await request(ctx.http)
      .post('/api/admin/products')
      .set('Authorization', auth)
      .send({
        name: 'Bad',
        priceCents: 10,
        stock: -1,
        imageUrl: 'http://insecure.example/x.png',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toEqual(
      expect.arrayContaining([
        'Price must be at least 50 cents',
        'Stock cannot be negative',
        'Image URL must be an https URL',
      ]),
    );
  });

  it('shows every order with its customer to admins', async () => {
    const { auth } = await createAdmin(ctx.prisma, ctx.http);
    const customer = await registerUser(ctx.http, { name: 'Grace' });
    const product = await createProduct(ctx.prisma);
    await request(ctx.http)
      .put(`/api/cart/items/${product.id}`)
      .set('Authorization', customer.auth)
      .send({ quantity: 1 });
    await request(ctx.http)
      .post('/api/checkout')
      .set('Authorization', customer.auth);

    const res = await request(ctx.http)
      .get('/api/admin/orders')
      .set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].customer.name).toBe('Grace');
  });
});
