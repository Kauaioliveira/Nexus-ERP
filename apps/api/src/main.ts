import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = configureApp(await NestFactory.create(AppModule));
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3333;
  await app.listen(port);
  new Logger('Bootstrap').log(`Nexus ERP API rodando em http://localhost:${port}`);
}

bootstrap();
