import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import { RequirePermission } from '../auth/require-permission.decorator';
import { maskPiiDeep } from '../pii/mask';
import { ZodValidationPipe } from '../validation/zod-validation.pipe';
import { AuditService } from './audit.service';

const AuditQuerySchema = z
  .object({
    entity: z.string().min(1).optional(),
    entityId: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(500).default(100),
  })
  .strict();

@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  /** Audit log for the auditor role. PII inside snapshots is masked (ADR 0005). */
  @RequirePermission('platform.audit.read')
  @Get()
  async list(
    @Query(new ZodValidationPipe(AuditQuerySchema))
    query: z.infer<typeof AuditQuerySchema>,
  ) {
    const entries = await this.audit.list(query);
    return { entries: maskPiiDeep(entries) };
  }
}
