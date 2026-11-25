/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// U15+U12: on Android a Modal is its own window that stops at the system bars unless it is
// translucent under both. Every sheet goes through SheetModal, which sets both props.
const dir = join(import.meta.dirname, '..', 'src', 'components');

test('SheetModal makes the Modal translucent under the status and navigation bars', () => {
  const src = readFileSync(join(dir, 'SheetModal.tsx'), 'utf8');
  assert.match(src, /<Modal \{\.\.\.props\} statusBarTranslucent navigationBarTranslucent \/>/);
});

test('every *Sheet.tsx uses SheetModal, not a bare Modal', () => {
  const sheets = readdirSync(dir).filter((f) => f.endsWith('Sheet.tsx'));
  assert.ok(sheets.length >= 6);
  for (const f of sheets) {
    const src = readFileSync(join(dir, f), 'utf8');
    assert.match(src, /<SheetModal /, f);
    assert.doesNotMatch(src, /<Modal[\s>]/, f);
  }
});
