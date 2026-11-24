/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FALLBACK, onResult, onRetry, type LocationState } from '../src/lib/locationState.ts';

const LAST = { latitude: 31.25, longitude: 34.79 };
const HERE = { latitude: 31.7, longitude: 35.2 };
const denied: LocationState = { status: 'fallback', coords: FALLBACK, reason: 'denied' };
const timeout: LocationState = { status: 'fallback', coords: FALLBACK, reason: 'error' };
const fix: LocationState = { status: 'ready', coords: HERE, fresh: true };

test('retry from denied keeps the reason when it fails again (not "last known")', () => {
  const retrying = onRetry(denied);
  assert.deepEqual(retrying, denied);
  assert.deepEqual(onResult(retrying, denied), denied);
});

test('retry from denied that succeeds moves to a fresh fix', () => {
  assert.deepEqual(onResult(onRetry(denied), fix), { status: 'ready', coords: HERE, fresh: true, here: HERE });
});

test('a fix arriving after the timeout fallback is accepted', () => {
  const afterTimeout = onResult({ status: 'loading' }, timeout);
  assert.deepEqual(afterTimeout, timeout);
  assert.deepEqual(onResult(afterTimeout, fix), { status: 'ready', coords: HERE, fresh: true, here: HERE });
});

test('a stale last-known location is never labelled fresh', () => {
  const instant: LocationState = { status: 'ready', coords: LAST, fresh: false };
  const stale = onResult(instant, timeout);
  assert.deepEqual(stale, { status: 'fallback', coords: LAST, reason: 'stale' });
  // Retrying and failing again stays "last known" at the real last place, not Tel Aviv.
  assert.deepEqual(onResult(onRetry(stale), timeout), stale);
});

test('retry from a fresh fix marks it not fresh until the phone answers', () => {
  const ready: LocationState = { status: 'ready', coords: HERE, fresh: true, here: HERE };
  assert.deepEqual(onRetry(ready), { status: 'ready', coords: HERE, fresh: false });
  assert.deepEqual(onRetry({ status: 'loading' }), { status: 'loading' });
});

test('a small move keeps the map where it is but updates the exact fix', () => {
  const near = { latitude: HERE.latitude + 0.0004, longitude: HERE.longitude }; // ~45 m
  const next = onResult({ status: 'ready', coords: HERE, fresh: true, here: HERE }, { status: 'ready', coords: near, fresh: true });
  assert.deepEqual(next, { status: 'ready', coords: HERE, fresh: true, here: near });
});
