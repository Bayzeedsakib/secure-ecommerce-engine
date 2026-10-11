import { validateEnv } from './env.validation.js';

const valid = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5433/db',
  JWT_SECRET: 'x'.repeat(32),
  STRIPE_SECRET_KEY: 'sk_test_abc123',
};

describe('validateEnv', () => {
  it('applies defaults for optional settings', () => {
    const env = validateEnv(valid);

    expect(env.PORT).toBe(5000);
    expect(env.CURRENCY).toBe('usd');
    expect(env.CHECKOUT_EXPIRES_MINUTES).toBe(30);
    expect(env.STRIPE_WEBHOOK_SECRET).toBe('');
  });

  it('converts numeric settings from strings', () => {
    const env = validateEnv({
      ...valid,
      PORT: '8080',
      CHECKOUT_EXPIRES_MINUTES: '45',
    });

    expect(env.PORT).toBe(8080);
    expect(env.CHECKOUT_EXPIRES_MINUTES).toBe(45);
  });

  it('rejects a short JWT secret', () => {
    expect(() => validateEnv({ ...valid, JWT_SECRET: 'short' })).toThrow(
      /JWT_SECRET must be at least 32 characters/,
    );
  });

  it('only accepts Stripe test-mode keys', () => {
    expect(() =>
      validateEnv({ ...valid, STRIPE_SECRET_KEY: 'sk_live_abc123' }),
    ).toThrow(/test-mode secret key/);
  });

  it('rejects checkout lifetimes Stripe would refuse', () => {
    expect(() =>
      validateEnv({ ...valid, CHECKOUT_EXPIRES_MINUTES: '10' }),
    ).toThrow();
    expect(() =>
      validateEnv({ ...valid, CHECKOUT_EXPIRES_MINUTES: '2000' }),
    ).toThrow();
  });
});
