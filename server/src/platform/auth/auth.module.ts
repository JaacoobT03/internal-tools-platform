import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { assertMockAllowed } from '../runtime/mock-guard';
import { MockAuthController } from './mock-auth.controller';
import { MockAuthService } from './mock-auth.service';
import { PermissionGuard } from './permission.guard';
import { PermissionRegistry } from './permission-registry';
import { PLATFORM_AUTH } from './platform-auth';

@Global()
@Module({
  controllers: [MockAuthController],
  providers: [
    PermissionRegistry,
    {
      provide: MockAuthService,
      inject: [PermissionRegistry],
      useFactory: (registry: PermissionRegistry) => {
        assertMockAllowed('Mock auth (X-User-Id header)');
        return new MockAuthService(registry);
      },
    },
    { provide: PLATFORM_AUTH, useExisting: MockAuthService },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
  exports: [PLATFORM_AUTH, PermissionRegistry],
})
export class AuthModule {}
