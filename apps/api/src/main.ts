import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // ── Security middleware ──────────────────────────────────────
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());

  // ── CORS (credentials enabled for httpOnly refresh cookie) ───
  app.enableCors({
    origin: config.get<string>('corsOrigin')?.split(',') ?? true,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // ── Global validation: whitelist + transform DTOs ────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const prefix = config.get<string>('globalPrefix') ?? 'api/v1';
  app.setGlobalPrefix(prefix);

  const port = config.get<number>('port') ?? 4000;
  await app.listen(port);
  logger.log(`🚀 ApexTrade API ready at http://localhost:${port}/${prefix}`);
}

bootstrap();
