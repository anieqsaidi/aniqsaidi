import assert from 'node:assert/strict';
import test from 'node:test';
import { indexFirst } from '../src/data/recordOrder.ts';
import { awards } from '../src/data/cv.ts';

test('explicit CMS indexes override ambiguous date formats', () => {
  const records = indexFirst([
    { id: 'older', period: '2017-2018', sortOrder: 2 },
    { id: 'newest', issuedAt: 'Nov 2024', sortOrder: 0 },
    { id: 'middle', description: 'Delivered during the 2019 carnival.', sortOrder: 1 },
  ]);
  assert.deepEqual(records.map(({ id }) => id), ['newest', 'middle', 'older']);
});

test('CMS index remains deterministic for undated records', () => {
  const records = indexFirst([
    { id: 'second', sortOrder: 2 },
    { id: 'first', sortOrder: 1 },
  ]);
  assert.deepEqual(records.map(({ id }) => id), ['first', 'second']);
});

test('dates never override the explicit CMS index', () => {
  const records = indexFirst([
    { id: 'newest', date: '2025', sortOrder: 1 },
    { id: 'older', date: '2020', sortOrder: 0 },
  ]);
  assert.deepEqual(records.map(({ id }) => id), ['older', 'newest']);
});

test('complete legacy manualOrder values cannot override the CMS index', () => {
  const records = indexFirst([
    { id: 'first', sortOrder: 1, manualOrder: 0 },
    { id: 'second', sortOrder: 0, manualOrder: 1 },
  ]);
  assert.deepEqual(records.map(({ id }) => id), ['second', 'first']);
});

test('partial legacy manualOrder values cannot override the CMS index', () => {
  const records = indexFirst([
    { id: 'first', sortOrder: 0 },
    { id: 'anchored-third', sortOrder: 1, manualOrder: 2 },
    { id: 'second', sortOrder: 2 },
  ]);
  assert.deepEqual(records.map(({ id }) => id), ['first', 'anchored-third', 'second']);
});

test("Dean's List remains newer than the iCE-CInno 2016 award", () => {
  const records = indexFirst(awards.map(([title, description], sortOrder) => ({ title, description, sortOrder })));
  const titles = records.map(({ title }) => title);
  assert.ok(titles.indexOf("Dean's List Award") < titles.indexOf('iCE-CInno 2016 Bronze Medal'));
});
