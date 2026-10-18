// Deliberate tripwire violations (PII leak, unaudited mutation), used only by
// tripwires.api-spec.ts. Never import this from src/.
import {
  BadRequestException,
  Controller,
  Get,
  Module,
  Post,
} from '@nestjs/common';
import { AuditService } from '../../src/platform/audit/audit.service';
import { CurrentUser } from '../../src/platform/auth/current-user.decorator';
import { PermissionRegistry } from '../../src/platform/auth/permission-registry';
import type { AuthUser } from '../../src/platform/auth/platform-auth';
import { RequirePermission } from '../../src/platform/auth/require-permission.decorator';
import { ROLES } from '../../src/platform/auth/roles';
import { maskCard, maskEmail } from '../../src/platform/pii/mask';
import { PiiRevealService } from '../../src/platform/pii/pii-reveal.service';
import { RevealEndpoint } from '../../src/platform/pii/reveal.decorator';
import { PrismaService } from '../../src/platform/prisma/prisma.service';

export const FIXTURE_EMAIL = 'jane.doe@example.com';
export const FIXTURE_CARD = '4242 4242 4242 4242';

@Controller('tripwire')
export class TripwireFixtureController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly pii: PiiRevealService,
  ) {}

  @RequirePermission('fixture.tripwire.read')
  @Get('leak-email')
  leakEmail() {
    return { customer: { email: FIXTURE_EMAIL } };
  }

  @RequirePermission('fixture.tripwire.read')
  @Get('leak-card')
  leakCard() {
    return { card: FIXTURE_CARD };
  }

  @RequirePermission('fixture.tripwire.read')
  @Get('masked')
  masked() {
    return { email: maskEmail(FIXTURE_EMAIL), card: maskCard(FIXTURE_CARD) };
  }

  @RevealEndpoint('fixture.tripwire.reveal')
  @Get('reveal-email')
  revealEmail(@CurrentUser() user: AuthUser) {
    return this.pii.reveal(
      user,
      {
        permission: 'fixture.tripwire.reveal',
        entity: 'fixture.Customer',
        entityId: 'c-1',
        field: 'email',
      },
      () => Promise.resolve({ email: FIXTURE_EMAIL }),
    );
  }

  @RequirePermission('fixture.tripwire.write')
  @Post('unaudited')
  unaudited() {
    return { ok: true };
  }

  @RequirePermission('fixture.tripwire.write')
  @Post('audited')
  async audited(@CurrentUser() user: AuthUser) {
    await this.prisma.$transaction((tx) =>
      this.audit.record(tx, {
        actor: user.id,
        entity: 'fixture.Thing',
        entityId: 't-1',
        action: 'create',
        after: { ok: true },
      }),
    );
    return { ok: true };
  }

  @RequirePermission('fixture.tripwire.write')
  @Post('rejected')
  rejected() {
    throw new BadRequestException('nothing changed');
  }
}

@Module({ controllers: [TripwireFixtureController] })
export class TripwireFixtureModule {
  constructor(registry: PermissionRegistry) {
    registry.grant('fixture.tripwire.read', ROLES);
    registry.grant('fixture.tripwire.write', ROLES);
    registry.grant('fixture.tripwire.reveal', ['auditor']);
  }
}
