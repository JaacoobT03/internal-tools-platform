import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from './current-user.decorator';
import { MockAuthService } from './mock-auth.service';
import type { AuthUser } from './platform-auth';
import { Public } from './public.decorator';
import { RequirePermission } from './require-permission.decorator';

@Controller('auth')
export class MockAuthController {
  constructor(private readonly auth: MockAuthService) {}

  /** Mock login: the seed users the client's user switcher offers. */
  @Public()
  @Get('users')
  users(): AuthUser[] {
    return this.auth.listUsers();
  }

  @RequirePermission('platform.session.read')
  @Get('me')
  me(@CurrentUser() user: AuthUser): {
    user: AuthUser;
    permissions: string[];
  } {
    return { user, permissions: this.auth.permissionsOf(user) };
  }
}
