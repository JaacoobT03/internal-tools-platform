import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { PrismaService } from '../src/platform/prisma/prisma.service';
import {
  FIXTURE_EMAIL,
  TripwireFixtureModule,
} from './fixtures/tripwire-violations.module';
import { asUser, TripwireError } from './helpers/as-user';
import { createTestApp } from './helpers/test-app';

describe('asUser tripwires', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp(TripwireFixtureModule);
  });
  afterAll(() => app.close());

  describe('(a) unmasked PII in responses', () => {
    it('fails on an unmasked email', async () => {
      const result = Promise.resolve(
        asUser(app, 'viewer').get('/tripwire/leak-email').expect(200),
      );
      await expect(result).rejects.toBeInstanceOf(TripwireError);
      await expect(result).rejects.toThrow(
        /PII tripwire: GET \/tripwire\/leak-email returned unmasked email \(j\*\*\*@example.com\)/,
      );
    });

    it('fails on a full card number', async () => {
      await expect(
        Promise.resolve(asUser(app, 'viewer').get('/tripwire/leak-card')),
      ).rejects.toThrow(/unmasked card \(\*\*\*\* \*\*\*\* \*\*\*\* 4242\)/);
    });

    it('fails with callback-style end() too', async () => {
      const error = await new Promise((resolve) => {
        asUser(app, 'viewer')
          .get('/tripwire/leak-email')
          .end((err) => resolve(err));
      });
      expect(error).toBeInstanceOf(TripwireError);
    });

    it('passes masked responses', async () => {
      await asUser(app, 'viewer').get('/tripwire/masked').expect(200);
    });

    it('allows unmasked values from a declared reveal endpoint, which is audited', async () => {
      const prisma = app.get(PrismaService);
      const before = await prisma.auditEntry.count({
        where: { entity: 'fixture.Customer', action: 'pii.reveal' },
      });
      const response = await asUser(app, 'auditor')
        .get('/tripwire/reveal-email')
        .expect(200);
      expect(response.body).toEqual({ email: FIXTURE_EMAIL });
      expect(
        await prisma.auditEntry.count({
          where: { entity: 'fixture.Customer', action: 'pii.reveal' },
        }),
      ).toBe(before + 1);
    });

    it('the reveal endpoint requires its permission', async () => {
      await asUser(app, 'viewer').get('/tripwire/reveal-email').expect(403);
    });
  });

  describe('(b) successful mutations without an audit entry', () => {
    it('fails on a successful unaudited POST', async () => {
      await expect(
        Promise.resolve(
          asUser(app, 'requester').post('/tripwire/unaudited').expect(201),
        ),
      ).rejects.toThrow(
        /Audit tripwire: POST \/tripwire\/unaudited returned 201 but wrote no audit entry/,
      );
    });

    it('passes an audited POST', async () => {
      await asUser(app, 'requester').post('/tripwire/audited').expect(201);
    });

    it('ignores unsuccessful mutations', async () => {
      await asUser(app, 'requester').post('/tripwire/rejected').expect(400);
    });
  });

  it('the tripwire fixtures are not registered in the real application', async () => {
    const realApp = await createTestApp();
    await asUser(realApp, 'viewer').get('/tripwire/leak-email').expect(404);
    await realApp.close();
  });
});
