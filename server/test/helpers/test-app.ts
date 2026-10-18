import { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';

/** Boots the real AppModule (plus optional test-only modules) against platform_test. */
export async function createTestApp(
  ...extraModules: Type[]
): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule, ...extraModules],
  }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  // Listen up front: supertest then targets the bound port instead of starting
  // and closing its own ephemeral server per request, which races with the
  // asynchronous audit count taken by asUser() before dispatch.
  await app.listen(0, '127.0.0.1');
  return app;
}
