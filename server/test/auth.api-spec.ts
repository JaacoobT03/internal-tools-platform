import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PAYMENTS_ADAPTER } from '../src/platform/payments/payments-adapter';
import { asUser } from './helpers/as-user';
import { createTestApp } from './helpers/test-app';

describe('Mock auth (ADR 0001)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  it('lists the seed users publicly for the user switcher', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/users')
      .expect(200);
    expect(response.body).toEqual([
      { id: 'u-requester', name: 'Rita Requester', roles: ['requester'] },
      { id: 'u-approver', name: 'Arne Approver', roles: ['approver'] },
      {
        id: 'u-requester-approver',
        name: 'Bea Both',
        roles: ['requester', 'approver'],
      },
      { id: 'u-auditor', name: 'Aud Auditor', roles: ['auditor'] },
      { id: 'u-viewer', name: 'Vic Viewer', roles: ['viewer'] },
    ]);
  });

  it('resolves the current user and permissions from X-User-Id', async () => {
    const response = await asUser(app, 'auditor').get('/auth/me').expect(200);
    const body = response.body as { user: unknown; permissions: string[] };
    expect(body.user).toEqual({
      id: 'u-auditor',
      name: 'Aud Auditor',
      roles: ['auditor'],
    });
    // Apps may grant the auditor more permissions; only require the platform's.
    expect(body.permissions).toEqual(
      expect.arrayContaining(['platform.audit.read', 'platform.session.read']),
    );
  });

  it('rejects an unknown user id with 401', async () => {
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('X-User-Id', 'u-nobody')
      .expect(401);
  });

  it('rejects a protected route without X-User-Id with 401', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });
});

describe('Production bootstrap', () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('refuses to bootstrap the server with mock auth when NODE_ENV=production', async () => {
    process.env.NODE_ENV = 'production';
    // Stub the (also refusing) mock payments adapter so this test isolates mock auth.
    await expect(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(PAYMENTS_ADAPTER)
        .useValue({})
        .compile(),
    ).rejects.toThrow(/Refusing to start: Mock auth/);
  });
});
