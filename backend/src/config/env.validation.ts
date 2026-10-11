import { plainToInstance, Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export const SUPPORTED_CURRENCIES = ['usd', 'eur', 'gbp'] as const;

const toInt = ({ value }: { value: unknown }) =>
  value === undefined || value === '' ? undefined : Number(value);

export class EnvironmentVariables {
  @IsString()
  DATABASE_URL: string;

  @IsString()
  @MinLength(32, { message: 'JWT_SECRET must be at least 32 characters long' })
  JWT_SECRET: string;

  @IsOptional()
  @IsString()
  JWT_EXPIRES_IN = '1d';

  // Only test-mode keys are accepted: this project is a payment sandbox and
  // must never be able to charge a real card.
  @Matches(/^sk_test_\w+$/, {
    message:
      'STRIPE_SECRET_KEY must be a Stripe test-mode secret key (starts with sk_test_)',
  })
  STRIPE_SECRET_KEY: string;

  // Optional: without it the webhook endpoint is disabled and payments are
  // confirmed when the customer returns to the success page instead.
  @IsOptional()
  @IsString()
  STRIPE_WEBHOOK_SECRET = '';

  @IsOptional()
  @IsIn(SUPPORTED_CURRENCIES)
  CURRENCY: (typeof SUPPORTED_CURRENCIES)[number] = 'usd';

  // Stripe only accepts Checkout Session lifetimes between 30 min and 24 h.
  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(30)
  @Max(1440)
  CHECKOUT_EXPIRES_MINUTES = 30;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(0)
  PORT = 5000;

  // Where Stripe sends the customer back after paying or cancelling.
  @IsOptional()
  @IsString()
  CLIENT_URL = 'http://localhost:5173';

  // Comma-separated browser origins allowed to call the API.
  @IsOptional()
  @IsString()
  CORS_ORIGIN = 'http://localhost:5173';

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(1)
  RATE_LIMIT_MAX = 300;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(1)
  AUTH_RATE_LIMIT_MAX = 20;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(0)
  TRUST_PROXY = 0;
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config, {
    exposeDefaultValues: true,
  });
  const errors = validateSync(env, { skipMissingProperties: false });

  if (errors.length > 0) {
    const messages = errors.flatMap((error) =>
      Object.values(error.constraints ?? {}),
    );
    throw new Error(
      `Invalid configuration (see .env.example):\n- ${messages.join('\n- ')}`,
    );
  }

  return env;
}
