import { Module } from '@nestjs/common';
import { PermissionRegistry } from '../../platform/auth/permission-registry';
import { RefundsController } from './refunds.controller';
import { RefundsDemoSeed } from './refunds.demo-seed';
import { RefundsService } from './refunds.service';

@Module({
  controllers: [RefundsController],
  providers: [RefundsService, RefundsDemoSeed],
})
export class RefundsModule {
  constructor(registry: PermissionRegistry) {
    registry.grant('refunds.refund.read', [
      'viewer',
      'requester',
      'approver',
      'auditor',
    ]);
    registry.grant('refunds.refund.create', ['requester']);
    registry.grant('refunds.refund.decide', ['approver']);
    registry.grant('refunds.customer-email.reveal', ['approver']);
  }
}
