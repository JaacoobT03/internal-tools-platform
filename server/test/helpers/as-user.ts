import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { seedUsers, SeedUserKey } from '../../src/platform/auth/mock-users';
import type { AuthUser } from '../../src/platform/auth/platform-auth';
import { findUnmaskedPii } from '../../src/platform/pii/mask';
import { PII_REVEAL_HEADER } from '../../src/platform/pii/reveal.decorator';
import { PrismaService } from '../../src/platform/prisma/prisma.service';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
const MUTATING: ReadonlySet<Method> = new Set([
  'post',
  'put',
  'patch',
  'delete',
]);

export class TripwireError extends Error {
  override name = 'TripwireError';
}

/**
 * supertest wrapper that signs in as a seed user (sets `X-User-Id`) and runs
 * the platform tripwires on every response:
 *
 * (a) PII: the body must not contain an unmasked email or card number unless
 *     the route is a declared reveal endpoint (@RevealEndpoint()).
 * (b) Audit: a successful (2xx) POST/PUT/PATCH/DELETE must create at least
 *     one audit entry.
 *
 * A tripwire failure rejects the request promise, failing the test.
 *
 *   await asUser(app, 'requester').post('/refunds').send(body).expect(201);
 */
export function asUser(
  app: INestApplication<App>,
  user: SeedUserKey | AuthUser,
) {
  const userId = typeof user === 'string' ? seedUsers[user].id : user.id;
  const prisma = app.get(PrismaService);
  const server = app.getHttpServer() as unknown as { listening?: boolean };
  if (!server.listening) {
    throw new Error('asUser() needs a listening app; use createTestApp().');
  }
  const agent = request(app.getHttpServer());
  const send = (method: Method) => (url: string) =>
    withTripwires(
      agent[method](url).set('X-User-Id', userId),
      method,
      url,
      prisma,
    );
  return {
    get: send('get'),
    post: send('post'),
    put: send('put'),
    patch: send('patch'),
    delete: send('delete'),
  };
}

function withTripwires(
  test: request.Test,
  method: Method,
  url: string,
  prisma: PrismaService,
): request.Test {
  const originalEnd = test.end.bind(test);
  // supertest's then() calls end(), so this covers both await and callbacks.
  test.end = (callback) => {
    const done = callback ?? (() => undefined);
    const countAudit = () =>
      MUTATING.has(method) ? prisma.auditEntry.count() : Promise.resolve(0);
    countAudit().then(
      (auditBefore) => {
        // Block body on purpose: returning the Test (a thenable) from this
        // callback would make the promise machinery call test.then() and send
        // the request a second time.
        originalEnd((error, response) => {
          if (error) return done(error, response);
          checkTripwires(method, url, response, auditBefore, countAudit).then(
            () => done(null, response),
            (tripwire: Error) => done(tripwire, response),
          );
        });
      },
      (error: Error) => done(error, undefined as unknown as request.Response),
    );
    return test;
  };
  return test;
}

async function checkTripwires(
  method: Method,
  url: string,
  response: request.Response,
  auditBefore: number,
  countAudit: () => Promise<number>,
): Promise<void> {
  const route = `${method.toUpperCase()} ${url}`;
  const isRevealEndpoint =
    response.headers[PII_REVEAL_HEADER.toLowerCase()] === 'true';
  if (!isRevealEndpoint) {
    const leaks = findUnmaskedPii(response.text ?? response.body);
    if (leaks.length > 0) {
      throw new TripwireError(
        `PII tripwire: ${route} returned unmasked ${leaks
          .map((leak) => `${leak.kind} (${leak.masked})`)
          .join(
            ', ',
          )}. Mask it (ADR 0005) or serve it from a @RevealEndpoint().`,
      );
    }
  }

  const succeeded = response.status >= 200 && response.status < 300;
  if (
    MUTATING.has(method) &&
    succeeded &&
    (await countAudit()) <= auditBefore
  ) {
    throw new TripwireError(
      `Audit tripwire: ${route} returned ${response.status} but wrote no audit entry (ADR 0003).`,
    );
  }
}
