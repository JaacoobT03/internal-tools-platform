import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthRequestLike, PlatformAuth } from './platform-auth';
import { PLATFORM_AUTH } from './platform-auth';
import { IS_PUBLIC_KEY } from './public.decorator';
import { REQUIRED_PERMISSION_KEY } from './require-permission.decorator';
import { RequestWithUser } from './current-user.decorator';

/**
 * Global guard (APP_GUARD), deny by default (ADR 0002). Only handler-level
 * decorators count: a handler without @RequirePermission() or @Public() is
 * refused even if the controller class carries one.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject(PLATFORM_AUTH) private readonly auth: PlatformAuth,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const handler = context.getHandler();
    const isPublic = this.reflector.get<boolean>(IS_PUBLIC_KEY, handler);
    const permission = this.reflector.get<string>(
      REQUIRED_PERMISSION_KEY,
      handler,
    );

    if (isPublic === true) return true;
    if (!permission) {
      this.logger.error(
        `Refused ${context.getClass().name}.${handler.name}: no @RequirePermission() or @Public()`,
      );
      throw new ForbiddenException(
        'Endpoint declares no permission (deny by default)',
      );
    }

    const request = context
      .switchToHttp()
      .getRequest<AuthRequestLike & RequestWithUser>();
    const user = this.auth.authenticate(request);
    if (!user) throw new UnauthorizedException('Not signed in');
    request.user = user;

    if (!this.auth.hasPermission(user, permission)) {
      throw new ForbiddenException(`Missing permission ${permission}`);
    }
    return true;
  }
}
