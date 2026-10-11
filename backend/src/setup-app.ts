import { ValidationPipe, type INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppConfigService } from './config/app-config.service.js';

// Shared by main.ts and the e2e tests so both run the exact same pipeline.
export function setupApp(app: NestExpressApplication): INestApplication {
  const config = app.get(AppConfigService);

  if (config.trustProxy) {
    app.set('trust proxy', config.trustProxy);
  }

  app.setGlobalPrefix('api');
  app.use(helmet());
  app.enableCors({
    // Requests without an Origin header (curl, Stripe webhooks) are allowed;
    // browsers only from the configured frontend origins.
    origin: (origin, callback) =>
      callback(null, !origin || config.corsOrigins.includes(origin)),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  });
  app.useBodyParser('json', { limit: '20kb' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('E-Commerce API')
      .setDescription(
        'Secure store API with JWT auth, a persistent cart and Stripe test-mode checkout',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('api/docs', app, document);

  return app;
}
