/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { motion, motionKey, staggerDelay } from '../src/theme.ts';

test('motion tokens match the design reference', () => {
  assert.deepEqual([...motion.ease], [0.22, 1, 0.36, 1]);
  assert.equal(motion.enter, 700);
  assert.equal(motion.micro, 180);
  assert.equal(motion.press, 90);
  assert.equal(motion.rise, 12);
  assert.equal(motion.stagger, 50);
  assert.ok(motion.pressScale > 0.95 && motion.pressScale < 1);
});

test('staggerDelay steps 50ms and caps', () => {
  assert.equal(staggerDelay(0), 0);
  assert.equal(staggerDelay(3), 150);
  assert.equal(staggerDelay(20), 300);
  assert.equal(staggerDelay(-1), 0);
});

test('motionKey: reorder -> same key; new/removed id -> new key', () => {
  const a = motionKey(['w1', 'n2', 'w3']);
  assert.equal(a, motionKey(['w1', 'n2', 'w3']));
  assert.equal(a, motionKey(['n2', 'w3', 'w1']));
  assert.notEqual(a, motionKey(['w1', 'n2', 'w4']));
  assert.notEqual(a, motionKey(['w1', 'n2']));
  assert.notEqual(a, motionKey(['w1', 'n2', 'w3', 'w5']));
});
