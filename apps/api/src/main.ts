import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const secret = process.env.JWT_SECRET ?? '';
  if (secret.length < 32) throw new Error('JWT_SECRET debe tener al menos 32 caracteres');

  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.use(helmet());
  app.enableCors({ origin: (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean), credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableShutdownHooks();

  const swagger = new DocumentBuilder().setTitle('AI Business Assistant API').setVersion('0.1.0').addBearerAuth().build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));

  await app.listen(Number(process.env.PORT ?? 3001));
}
bootstrap();
