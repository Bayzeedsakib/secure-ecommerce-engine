import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule } from './config/config.module.js';
import { AppConfigService } from './config/app-config.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthController } from './health/health.controller.js';
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
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: StripeExceptionFilter },
  ],
})
export class AppModule {}
