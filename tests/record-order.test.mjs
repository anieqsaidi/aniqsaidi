import assert from 'node:assert/strict';
import test from 'node:test';
import { latestFirst } from '../src/data/recordOrder.ts';

test('dated records are ordered latest to oldest across date formats', () => {
  const records = latestFirst([
    { id: 'older', period: '2017-2018', sortOrder: 0 },
    { id: 'newest', issuedAt: 'Nov 2024', sortOrder: 2 },
    { id: 'middle', description: 'Delivered during the 2019 carnival.', sortOrder: 1 },
  ]);
  assert.deepEqual(records.map(({ id }) => id), ['newest', 'middle', 'older']);
});

test('manual order remains the deterministic tie-breaker for undated records', () => {
  const records = latestFirst([
    { id: 'second', sortOrder: 2 },
    { id: 'first', sortOrder: 1 },
  ]);
  assert.deepEqual(records.map(({ id }) => id), ['first', 'second']);
});
