import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(
    z.object({ limit: z.coerce.number().int().max(10) }).strict(),
  );

  it('returns the parsed value', () => {
    expect(pipe.transform({ limit: '5' })).toEqual({ limit: 5 });
  });

  it('throws 400 with issues on invalid input', () => {
    expect.assertions(2);
    try {
      pipe.transform({ limit: '50', extra: true });
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        message: 'Validation failed',
        issues: expect.arrayContaining([
          expect.objectContaining({ path: 'limit' }),
        ]) as unknown,
      });
    }
  });
});
