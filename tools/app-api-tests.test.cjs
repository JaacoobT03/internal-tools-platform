// App API tests live in server/src/apps/<name>/test/*.api-spec.ts. Proves
// `pnpm test:api` picks them up and the server build leaves them out.
const fs = require('node:fs');
const path = require('node:path');

const server = path.resolve(__dirname, '..', 'server');
const readJson = (file) =>
  JSON.parse(fs.readFileSync(path.join(server, file), 'utf8'));

const APP_TEST = 'src/apps/example/test/example.api-spec.ts';

test('the API test config matches app API tests', () => {
  const { testRegex } = readJson('test/jest-api.json');
  expect(new RegExp(testRegex).test(APP_TEST)).toBe(true);
});

test('the unit test config does not run API tests', () => {
  const { jest } = readJson('package.json');
  expect(new RegExp(jest.testRegex).test(APP_TEST)).toBe(false);
});

test('the server build excludes API tests', () => {
  const { exclude } = readJson('tsconfig.build.json');
  expect(exclude).toContain('**/*.api-spec.ts');
});
