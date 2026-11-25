/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

// The reminder chips are radios. On web, react-native-web maps only `aria-checked` (not
// `accessibilityState.checked`) to the DOM attribute, so the chip must pass `aria-checked`.
const require = createRequire(import.meta.url);
const createDOMProps: (type: string, props: Record<string, unknown>) => Record<string, unknown> =
  require('react-native-web/dist/cjs/modules/createDOMProps');

const source = readFileSync(join(import.meta.dirname, '..', 'src', 'components', 'ReminderSheet.tsx'), 'utf8');

test('web: a chip with aria-checked renders role radio and aria-checked matching selection', () => {
  for (const selected of [true, false]) {
    const dom = createDOMProps('div', { accessibilityRole: 'radio', 'aria-checked': selected });
    assert.equal(dom.role, 'radio');
    assert.equal(dom['aria-checked'], selected);
  }
});

test('web: accessibilityState.checked alone does not reach the DOM (why the chip needs aria-checked)', () => {
  const dom = createDOMProps('div', { accessibilityRole: 'radio', accessibilityState: { selected: true, checked: true } });
  assert.equal(dom['aria-checked'], undefined);
});

test('ReminderSheet Chip passes aria-checked from selection and keeps the native accessibilityState', () => {
  const chip = source.slice(source.indexOf('function Chip('), source.indexOf('const styles = StyleSheet.create'));
  assert.match(chip, /accessibilityRole="radio"/);
  assert.match(chip, /aria-checked=\{selected\}/);
  assert.match(chip, /accessibilityState=\{\{ selected, checked: selected \}\}/);
});

test('ReminderSheet: both chip rows are a radiogroup', () => {
  const groups = source.match(/<View style=\{styles\.chips\} accessibilityRole="radiogroup">/g) ?? [];
  assert.equal(groups.length, 2);
});
