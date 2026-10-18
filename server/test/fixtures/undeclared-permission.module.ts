// Deliberate violations of ADR 0002, used only by
// permission-convention.api-spec.ts. Never import this from src/.
import { Controller, Get, Module } from '@nestjs/common';
import { Public } from '../../src/platform/auth/public.decorator';
import { RequirePermission } from '../../src/platform/auth/require-permission.decorator';

@Controller('fixture-undeclared')
export class UndeclaredPermissionController {
  @Get()
  forgotDecorator(): { secret: string } {
    return { secret: 'should never be served' };
  }

  @RequirePermission('platform.audit.read')
  @Get('declared')
  declared(): { ok: boolean } {
    return { ok: true };
  }
}

@Public()
@Controller('fixture-class-public')
export class ClassLevelPublicController {
  @Get()
  classDecoratorOnly(): { secret: string } {
    return { secret: 'should never be served' };
  }
}

@Module({
  controllers: [UndeclaredPermissionController, ClassLevelPublicController],
})
export class UndeclaredPermissionFixtureModule {}
