import {
  Controller,
  ExecutionContext,
  ForbiddenException,
  Get,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MockAuthService } from './mock-auth.service';
import { PermissionGuard } from './permission.guard';
import { PermissionRegistry } from './permission-registry';
import { Public } from './public.decorator';
import { RequirePermission } from './require-permission.decorator';

@Controller()
class SampleController {
  @Public()
  @Get()
  open(): void {}

  @RequirePermission('platform.audit.read')
  @Get()
  audited(): void {}

  @Get()
  undeclared(): void {}
}

@Public()
@Controller()
class ClassLevelPublicController {
  @Get()
  handler(): void {}
}

function contextFor(
  controller: object,
  method: string,
  headers: Record<string, string> = {},
): { context: ExecutionContext; request: { headers: object; user?: unknown } } {
  const request: { headers: object; user?: unknown } = { headers };
  const proto = Object.getPrototypeOf(controller) as Record<string, unknown>;
  const context = {
    getHandler: () => proto[method],
    getClass: () => controller.constructor,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('PermissionGuard', () => {
  const guard = new PermissionGuard(
    new Reflector(),
    new MockAuthService(new PermissionRegistry()),
  );
  const sample = new SampleController();

  it('allows @Public() handlers without a user', () => {
    expect(guard.canActivate(contextFor(sample, 'open').context)).toBe(true);
  });

  it('refuses handlers with neither decorator (deny by default)', () => {
    const { context } = contextFor(sample, 'undeclared', {
      'x-user-id': 'u-auditor',
    });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('ignores class-level @Public(): only handler decorators count', () => {
    const { context } = contextFor(new ClassLevelPublicController(), 'handler');
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('requires a signed-in user for permission-protected handlers', () => {
    const { context } = contextFor(sample, 'audited');
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('refuses users without the permission (403)', () => {
    const { context } = contextFor(sample, 'audited', {
      'x-user-id': 'u-viewer',
    });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows users with the permission and sets request.user', () => {
    const { context, request } = contextFor(sample, 'audited', {
      'x-user-id': 'u-auditor',
    });
    expect(guard.canActivate(context)).toBe(true);
    expect(request.user).toMatchObject({ id: 'u-auditor' });
  });

  it('rejects malformed permission names at decoration time', () => {
    expect(() => RequirePermission('audit')).toThrow(/Invalid permission/);
  });
});
