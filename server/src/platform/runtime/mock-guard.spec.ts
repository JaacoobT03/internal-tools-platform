import { assertMockAllowed } from './mock-guard';

describe('assertMockAllowed', () => {
  it('refuses NODE_ENV=production', () => {
    expect(() => assertMockAllowed('Mock auth', 'production')).toThrow(
      /Refusing to start: Mock auth/,
    );
  });

  it.each([undefined, 'development', 'test'])('allows NODE_ENV=%s', (env) => {
    expect(() => assertMockAllowed('Mock auth', env)).not.toThrow();
  });
});
