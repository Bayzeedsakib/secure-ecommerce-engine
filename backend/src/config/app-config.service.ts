import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from './env.validation.js';

// Typed, validated access to configuration so the rest of the code never
// reads process.env directly.
@Injectable()
export class AppConfigService {
  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  private get<K extends keyof EnvironmentVariables>(
    key: K,
  ): EnvironmentVariables[K] {
    return this.config.get(key, { infer: true });
  }

  get databaseUrl() {
    return this.get('DATABASE_URL');
  }

  get jwtSecret() {
    return this.get('JWT_SECRET');
  }

  get jwtExpiresIn() {
    return this.get('JWT_EXPIRES_IN');
  }

  get stripeSecretKey() {
    return this.get('STRIPE_SECRET_KEY');
  }

  get stripeWebhookSecret() {
    return this.get('STRIPE_WEBHOOK_SECRET');
  }

  get currency() {
    return this.get('CURRENCY');
  }

  get checkoutExpiresMinutes() {
    return this.get('CHECKOUT_EXPIRES_MINUTES');
  }

  get port() {
    return this.get('PORT');
  }

  get clientUrl() {
    return this.get('CLIENT_URL').replace(/\/+$/, '');
  }

  get corsOrigins() {
    return this.get('CORS_ORIGIN')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  get rateLimitMax() {
    return this.get('RATE_LIMIT_MAX');
  }

  get authRateLimitMax() {
    return this.get('AUTH_RATE_LIMIT_MAX');
  }

  get trustProxy() {
    return this.get('TRUST_PROXY');
  }
}
