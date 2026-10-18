import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { AuthUser } from './platform-auth';

export interface RequestWithUser {
  user?: AuthUser;
}

/** The authenticated user, set by PermissionGuard. Not available on @Public() routes. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const user = context.switchToHttp().getRequest<RequestWithUser>().user;
    if (!user) {
      throw new InternalServerErrorException(
        '@CurrentUser() used on a route without an authenticated user',
      );
    }
    return user;
  },
);
