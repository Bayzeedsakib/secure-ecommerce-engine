import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { AppConfigService } from './config/app-config.service.js';
import { setupApp } from './setup-app.js';

async function bootstrap() {
  // rawBody is kept so Stripe webhook signatures can be verified.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  setupApp(app);

  const port = app.get(AppConfigService).port;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}/api (docs: /api/docs)`);
}

await bootstrap();
