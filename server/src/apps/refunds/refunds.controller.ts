import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../platform/auth/current-user.decorator';
import type { AuthUser } from '../../platform/auth/platform-auth';
import { RequirePermission } from '../../platform/auth/require-permission.decorator';
import { RevealEndpoint } from '../../platform/pii/reveal.decorator';
import { ZodValidationPipe } from '../../platform/validation/zod-validation.pipe';
import type { RefundView } from './refund.view';
import {
  CreateRefundSchema,
  ListRefundsQuerySchema,
  RefundIdSchema,
} from './refunds.schemas';
import type { CreateRefund, ListRefundsQuery } from './refunds.schemas';
import { RefundsService, REVEAL_EMAIL_PERMISSION } from './refunds.service';

@Controller('refunds')
export class RefundsController {
  constructor(private readonly refunds: RefundsService) {}

  @RequirePermission('refunds.refund.read')
  @Get()
  list(
    @Query(new ZodValidationPipe(ListRefundsQuerySchema))
    query: ListRefundsQuery,
  ): Promise<RefundView[]> {
    return this.refunds.list(query);
  }

  @RequirePermission('refunds.refund.read')
  @Get(':id')
  get(
    @Param('id', new ZodValidationPipe(RefundIdSchema)) id: string,
  ): Promise<RefundView> {
    return this.refunds.get(id);
  }

  @RequirePermission('refunds.refund.create')
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateRefundSchema)) body: CreateRefund,
  ): Promise<RefundView> {
    return this.refunds.create(user, body);
  }

  @RequirePermission('refunds.refund.decide')
  @Post(':id/approve')
  @HttpCode(200)
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id', new ZodValidationPipe(RefundIdSchema)) id: string,
  ): Promise<RefundView> {
    return this.refunds.approve(user, id);
  }

  @RequirePermission('refunds.refund.decide')
  @Post(':id/reject')
  @HttpCode(200)
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id', new ZodValidationPipe(RefundIdSchema)) id: string,
  ): Promise<RefundView> {
    return this.refunds.reject(user, id);
  }

  @RevealEndpoint(REVEAL_EMAIL_PERMISSION)
  @Post(':id/reveal-email')
  @HttpCode(200)
  revealEmail(
    @CurrentUser() user: AuthUser,
    @Param('id', new ZodValidationPipe(RefundIdSchema)) id: string,
  ): Promise<{ customerEmail: string }> {
    return this.refunds.revealEmail(user, id);
  }
}
