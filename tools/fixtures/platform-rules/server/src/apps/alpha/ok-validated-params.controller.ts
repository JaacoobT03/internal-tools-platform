import { Body, Controller, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../platform/validation/zod-validation.pipe';

const Id = z.uuid();
const Filter = z.object({ q: z.string().optional() });
const Create = z.object({ name: z.string() });

@Controller('alpha')
export class AlphaController {
  @Post(':id')
  create(
    @Param('id', new ZodValidationPipe(Id)) id: string,
    @Query(new ZodValidationPipe(Filter)) query: z.infer<typeof Filter>,
    @Body(new ZodValidationPipe(Create)) body: z.infer<typeof Create>,
  ) {
    return { id, query, body };
  }
}
