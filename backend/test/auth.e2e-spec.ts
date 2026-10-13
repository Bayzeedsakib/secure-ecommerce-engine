import request from 'supertest';
import {
  createTestApp,
  registerUser,
  resetDatabase,
  type TestContext,
} from './support/test-app.js';

describe('auth', () => {
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

  it('registers a customer and returns a token without the password hash', async () => {
    const res = await request(ctx.http).post('/api/auth/register').send({
      name: '  Ada  ',
      email: 'ADA@Example.com',
      password: 'a-long-password',
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toEqual({
      id: expect.any(String),
      name: 'Ada',
      email: 'ada@example.com',
      role: 'CUSTOMER',
    });
  });

  it('stores passwords as bcrypt hashes', async () => {
    await registerUser(ctx.http, { password: 'plain-text-password' });

    const [user] = await ctx.prisma.user.findMany();
    expect(user.passwordHash).not.toContain('plain-text-password');
    expect(user.passwordHash).toMatch(/^\$2[aby]\$12\$/);
  });

  it('does not let a client register as admin', async () => {
    const res = await request(ctx.http).post('/api/auth/register').send({
      name: 'Mallory',
      email: 'mallory@example.com',
      password: 'a-long-password',
      role: 'ADMIN',
    });

    expect(res.status).toBe(400);
    expect(await ctx.prisma.user.count()).toBe(0);
  });

  it('rejects invalid input with field messages', async () => {
    const res = await request(ctx.http)
      .post('/api/auth/register')
      .send({ name: '', email: 'not-an-email', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.message).toEqual(
      expect.arrayContaining([
        'Name is required',
        'Email must be a valid email address',
        'Password must be at least 8 characters',
      ]),
    );
  });

  it('rejects a duplicate email regardless of case', async () => {
    await registerUser(ctx.http, { email: 'dup@example.com' });

    const res = await request(ctx.http)
      .post('/api/auth/register')
      .send({
        name: 'Again',
        email: 'DUP@example.com',
        password: 'a-long-password',
      });

    expect(res.status).toBe(409);
  });

  it('logs in with the right password only', async () => {
    const { credentials } = await registerUser(ctx.http);

    const ok = await request(ctx.http)
      .post('/api/auth/login')
      .send({ email: credentials.email, password: credentials.password });
    const wrong = await request(ctx.http)
      .post('/api/auth/login')
      .send({ email: credentials.email, password: 'wrong-password' });
    const unknown = await request(ctx.http)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrong-password' });

    expect(ok.status).toBe(200);
    expect(ok.body.token).toEqual(expect.any(String));
    // The same message for both, so attackers cannot discover which emails exist.
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.message).toBe(unknown.body.message);
  });

  it('protects /me and rejects missing or tampered tokens', async () => {
    const { auth, user } = await registerUser(ctx.http);

    const me = await request(ctx.http)
      .get('/api/auth/me')
      .set('Authorization', auth);
    const missing = await request(ctx.http).get('/api/auth/me');
    const tampered = await request(ctx.http)
      .get('/api/auth/me')
      .set('Authorization', `${auth.slice(0, -2)}xx`);

    expect(me.status).toBe(200);
    expect(me.body.user.id).toBe(user.id);
    expect(missing.status).toBe(401);
    expect(tampered.status).toBe(401);
  });

  it('rejects the token of a deleted account', async () => {
    const { auth, user } = await registerUser(ctx.http);
    await ctx.prisma.user.delete({ where: { id: user.id } });

    const res = await request(ctx.http)
      .get('/api/auth/me')
      .set('Authorization', auth);

    expect(res.status).toBe(401);
  });
});
