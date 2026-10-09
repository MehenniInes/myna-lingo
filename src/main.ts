import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Static files (uploads)
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  // CORS — allow localhost + production (Vercel)
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      // ⚠️ Add your Vercel URL here after deploying frontend:
      // 'https://myna-lingo.vercel.app',
    ],
    credentials: true,
  });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );

  // Port: Railway assigns via PORT env, local fallback 3001
  const port = Number(process.env.PORT) || 3001;

  // 0.0.0.0 = accept external connections (required for Railway/Docker)
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Backend running on port ${port}`);
}
bootstrap();