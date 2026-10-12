import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule } from './config/config.module.js';
import { AppConfigService } from './config/app-config.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ProductsModule } from './products/products.module.js';
import { HealthController } from './health/health.controller.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { StripeExceptionFilter } from './common/filters/stripe-exception.filter.js';
import { isAuthRateLimited } from './common/throttling.js';

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: RATE_LIMIT_WINDOW_MS,
            limit: config.rateLimitMax,
          },
          {
            name: 'auth',
            ttl: RATE_LIMIT_WINDOW_MS,
            limit: config.authRateLimitMax,
            skipIf: (context) => !isAuthRateLimited(context),
          },
        ],
        errorMessage: 'Too many requests, please try again later',
      }),
    }),
    AuthModule,
    ProductsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Guards run in this order: rate limit, then authentication, then roles.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: StripeExceptionFilter },
  ],
})
export class AppModule {}
