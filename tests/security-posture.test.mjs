import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('CV storage and metadata are admin-only while API routes are rewritten to functions', async () => {
  const [storage, firestore, firebase] = await Promise.all([read('storage.rules'), read('firestore.rules'), read('firebase.json')]);
  assert.match(storage, /match \/public\/resume\/\{fileName\}[\s\S]*allow read: if isAdmin\(\)/);
  assert.match(firestore, /match \/cmsResume\/\{state\}[\s\S]*allow read: if isAdmin\(\)/);
  assert.match(firebase, /"source": "\/api\/cv\/verify"/);
  assert.match(firebase, /"source": "\/api\/cv\/download"/);
});

test('public defaults minimize name, location, and education history', async () => {
  const cv = await read('src/data/cv.ts');
  assert.match(cv, /name: 'Aniq Saidi'/);
  assert.match(cv, /location: 'Selangor, Malaysia'/);
  const educationBlock = cv.slice(cv.indexOf('export const education'), cv.indexOf('export const undergraduateThesis'));
  assert.doesNotMatch(educationBlock, /Matriculation|SMK/);
});

test('security headers and token-route privacy controls are configured', async () => {
  const [firebase, functions] = await Promise.all([read('firebase.json'), read('functions/index.mjs')]);
  for (const header of ['Strict-Transport-Security', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy']) assert.match(firebase, new RegExp(header));
  assert.match(functions, /Referrer-Policy', 'no-referrer'/);
  assert.match(functions, /X-Robots-Tag', 'noindex, nofollow, noarchive'/);
});
