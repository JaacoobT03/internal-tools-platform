import { Controller, HttpCode, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/platform-auth';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ZodValidationPipe } from '../validation/zod-validation.pipe';
import { ApprovalsService } from './approvals.service';
import type { ApprovalView } from './approvals.service';

const IdSchema = z.uuid();

@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @RequirePermission('platform.approvals.decide')
  @Post(':id/approve')
  @HttpCode(200)
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id', new ZodValidationPipe(IdSchema)) id: string,
  ): Promise<ApprovalView> {
    return this.approvals.approve(user, id);
  }

  @RequirePermission('platform.approvals.decide')
  @Post(':id/reject')
  @HttpCode(200)
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id', new ZodValidationPipe(IdSchema)) id: string,
  ): Promise<ApprovalView> {
    return this.approvals.reject(user, id);
  }
}
