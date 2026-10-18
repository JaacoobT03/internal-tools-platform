// Proves the platform ESLint rules (tools/eslint-rules) fail on deliberate
// violations in tools/fixtures/platform-rules and pass on allowed code:
// - platform/no-payment-sdk-import (ADR 0006)
// - platform/validated-request-input (Zod pipe on @Body/@Query/@Param)
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const fixtures = path.join(__dirname, 'fixtures', 'platform-rules');

function lintFixtures() {
  let output;
  try {
    output = execFileSync(
      path.join(root, 'node_modules', '.bin', 'eslint'),
      ['--no-ignore', '--format', 'json', fixtures],
      { cwd: root, encoding: 'utf8' },
    );
  } catch (error) {
    output = error.stdout;
  }
  return Object.fromEntries(
    JSON.parse(output).map((result) => [
      path.relative(fixtures, result.filePath),
      result.messages,
    ]),
  );
}

const byRule = (messages, rule) =>
  (messages ?? []).filter((message) => message.ruleId === rule);

describe('platform ESLint rules', () => {
  const results = lintFixtures();

  it('lints every fixture without parse errors', () => {
    const fatal = Object.entries(results).filter(([, messages]) =>
      messages.some((message) => message.fatal),
    );
    expect(fatal).toEqual([]);
  });

  describe('platform/no-payment-sdk-import', () => {
    const RULE = 'platform/no-payment-sdk-import';

    it.each([
      'server/src/apps/alpha/bad-imports-stripe.ts',
      'server/src/apps/alpha/bad-imports-stripe-subpath.ts',
      'server/src/apps/alpha/bad-requires-braintree.cjs',
      'server/src/apps/alpha/bad-dynamic-import-adyen.ts',
      'server/src/apps/alpha/bad-import-equals-stripe.ts',
      'server/src/platform/audit/bad-imports-stripe.ts',
      'client/lib/bad-imports-stripe.ts',
    ])('rejects %s', (file) => {
      expect(byRule(results[file], RULE)).toHaveLength(1);
    });

    it.each([
      'server/src/platform/payments/ok-imports-stripe.ts',
      'server/src/apps/alpha/ok-imports-similar-names.ts',
    ])('allows %s', (file) => {
      expect(results[file]).toBeDefined();
      expect(byRule(results[file], RULE)).toEqual([]);
    });
  });

  describe('platform/validated-request-input', () => {
    const RULE = 'platform/validated-request-input';

    it.each([
      ['server/src/apps/alpha/bad-bare-params.controller.ts', 3],
      ['server/src/apps/alpha/bad-non-zod-pipe.controller.ts', 1],
      ['server/src/apps/alpha/bad-aliased-body.controller.ts', 2],
      ['server/test/bad-bare-body-in-test-controller.ts', 1],
    ])('rejects %s', (file, count) => {
      expect(byRule(results[file], RULE)).toHaveLength(count);
    });

    it.each([
      'server/src/apps/alpha/ok-validated-params.controller.ts',
      'server/src/apps/alpha/ok-other-body-decorator.ts',
    ])('allows %s', (file) => {
      expect(results[file]).toBeDefined();
      expect(byRule(results[file], RULE)).toEqual([]);
    });
  });
});
