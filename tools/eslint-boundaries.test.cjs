// Proves the ESLint boundary rules (AGENTS.md rule 6) fail on deliberate
// violations in tools/fixtures/boundaries and pass on allowed imports.
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const fixtures = path.join(__dirname, 'fixtures', 'boundaries');
const RULE = 'boundaries/dependencies';

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
      result.messages.filter((message) => message.ruleId === RULE),
    ]),
  );
}

describe('ESLint boundary rules', () => {
  const violations = lintFixtures();

  it.each([
    'server/src/apps/alpha/bad-imports-other-app.ts',
    'server/src/platform/bad-imports-app.ts',
    'client/app/alpha/bad-imports-other-app.ts',
    'client/lib/bad-imports-app.ts',
  ])('rejects %s', (file) => {
    expect(violations[file]).toHaveLength(1);
  });

  it.each([
    'server/src/apps/alpha/ok-imports.ts',
    'server/src/apps/alpha/alpha.ts',
    'server/src/platform/util.ts',
    'client/app/alpha/ok-imports.ts',
    'client/lib/util.ts',
  ])('allows %s', (file) => {
    expect(violations[file]).toEqual([]);
  });
});
