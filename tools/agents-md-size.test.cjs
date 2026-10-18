// Devin only includes AGENTS.md automatically up to 16 KiB; keep it under that.
const fs = require('node:fs');
const path = require('node:path');

const MAX_BYTES = 16384;

test(`AGENTS.md is at most ${MAX_BYTES} bytes`, () => {
  const size = fs.statSync(path.resolve(__dirname, '..', 'AGENTS.md')).size;
  expect(size).toBeLessThanOrEqual(MAX_BYTES);
});
