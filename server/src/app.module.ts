import { Module } from '@nestjs/common';
import { HealthModule } from './platform/health/health.module';
import { PrismaModule } from './platform/prisma/prisma.module';

// Composition root. App PRs may add exactly one import + module entry here
// for their own module (ADR 0007); nothing else.
@Module({
  imports: [PrismaModule, HealthModule],
})
export class AppModule {}
