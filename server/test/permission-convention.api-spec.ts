import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { UndeclaredPermissionFixtureModule } from './fixtures/undeclared-permission.module';
import {
  scanHandlers,
  undeclaredHandlers,
} from './helpers/permission-convention';
import { createTestApp } from './helpers/test-app';

describe('Permission convention (ADR 0002)', () => {
  it('every handler in the application declares @RequirePermission() or @Public()', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const handlers = scanHandlers(moduleRef).map((entry) => entry.handler);
    // Guard against a vacuous scan.
    expect(handlers).toEqual(
      expect.arrayContaining([
        'HealthController.check',
        'AuditController.list',
        'ApprovalsController.approve',
        'MockAuthController.me',
      ]),
    );
    expect(undeclaredHandlers(moduleRef)).toEqual([]);
    await moduleRef.close();
  });

  it('catches a deliberate violation (incl. class-level-only @Public())', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, UndeclaredPermissionFixtureModule],
    }).compile();
    expect(undeclaredHandlers(moduleRef)).toEqual([
      'UndeclaredPermissionController.forgotDecorator',
      'ClassLevelPublicController.classDecoratorOnly',
    ]);
    await moduleRef.close();
  });

  it('the global guard refuses undeclared handlers at runtime (deny by default)', async () => {
    const app = await createTestApp(UndeclaredPermissionFixtureModule);
    const server = app.getHttpServer();
    await request(server)
      .get('/fixture-undeclared')
      .set('X-User-Id', 'u-auditor')
      .expect(403);
    await request(server).get('/fixture-class-public').expect(403);
    await request(server)
      .get('/fixture-undeclared/declared')
      .set('X-User-Id', 'u-auditor')
      .expect(200);
    await app.close();
  });

  it('the violation fixtures are not registered in the real application', async () => {
    const app = await createTestApp();
    await request(app.getHttpServer())
      .get('/fixture-undeclared')
      .set('X-User-Id', 'u-auditor')
      .expect(404);
    await app.close();
  });
});
