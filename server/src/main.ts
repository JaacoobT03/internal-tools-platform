import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:3000',
  });
  app.enableShutdownHooks();
  // Mock auth trusts X-User-Id, so only listen on loopback unless told otherwise
  // (compose sets HOST=0.0.0.0 inside the container and publishes on 127.0.0.1).
  await app.listen(
    Number(process.env.PORT ?? 3001),
    process.env.HOST ?? '127.0.0.1',
  );
}

void bootstrap();
