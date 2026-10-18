import { ServiceUnavailableException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../auth/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const queryRaw = jest.fn();
  const controller = new HealthController({
    $queryRaw: queryRaw,
  } as unknown as PrismaService);

  beforeEach(() => queryRaw.mockReset());

  it('reports ok when the database answers', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      db: 'up',
    });
  });

  it('returns 503 when the database is unreachable', async () => {
    queryRaw.mockRejectedValue(new Error('connection refused'));
    await expect(controller.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('is explicitly public', () => {
    const isPublic = new Reflector().get<boolean>(
      IS_PUBLIC_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      HealthController.prototype.check,
    );
    expect(isPublic).toBe(true);
  });
});
