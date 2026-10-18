import { Test } from '@nestjs/testing';
import { AuthModule } from './auth.module';
import { PLATFORM_AUTH } from './platform-auth';

describe('AuthModule', () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('provides mock auth outside production', async () => {
    process.env.NODE_ENV = 'development';
    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();
    expect(moduleRef.get(PLATFORM_AUTH)).toBeDefined();
  });

  it('refuses to bootstrap mock auth with NODE_ENV=production', async () => {
    process.env.NODE_ENV = 'production';
    await expect(
      Test.createTestingModule({ imports: [AuthModule] }).compile(),
    ).rejects.toThrow(/Refusing to start: Mock auth/);
  });
});
