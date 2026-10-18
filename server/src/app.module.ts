import { Module } from '@nestjs/common';
import { ApprovalsModule } from './platform/approvals/approvals.module';
import { AuditModule } from './platform/audit/audit.module';
import { AuthModule } from './platform/auth/auth.module';
import { HealthModule } from './platform/health/health.module';
import { PaymentsModule } from './platform/payments/payments.module';
import { PiiModule } from './platform/pii/pii.module';
import { PrismaModule } from './platform/prisma/prisma.module';
import { RefundsModule } from './apps/refunds/refunds.module';

// Composition root. App PRs may add exactly one import + module entry here
// for their own module (ADR 0007); nothing else.
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AuditModule,
    PiiModule,
    ApprovalsModule,
    PaymentsModule,
    HealthModule,
    RefundsModule,
  ],
})
export class AppModule {}
