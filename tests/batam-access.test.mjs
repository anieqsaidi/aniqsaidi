import assert from 'node:assert/strict';
import test from 'node:test';
import { adminSnapshot, BATAM_ACCOUNTS, BATAM_TRAVELLERS, documentForAccount, profileForAccount } from '../functions/batam-trip.mjs';
import { readFileSync } from 'node:fs';

const expectedMembers = {
  aniq: ['aniq'], faisal: ['faisal'],
  khairrin: ['khairrin', 'intan'], intan: ['khairrin', 'intan'],
  dedi: ['dedi', 'azilah'], azilah: ['dedi', 'azilah'],
  badiuz: ['badiuz', 'nasuha', 'nayla'], nasuha: ['badiuz', 'nasuha', 'nayla'],
};
const expectedCoreDocuments = {
  aniq: ['arrival-aniq', 'esim-aniq', 'evisa-aniq', 'ferry', 'hotel-af', 'insurance-zurich'],
  faisal: ['arrival-faisal', 'esim-faisal', 'evisa-faisal', 'ferry', 'hotel-af', 'insurance-zurich'],
  khairrin: ['arrival-khairrin-intan-dedi-azilah', 'esim-intan', 'esim-khairrin', 'evisa-intan', 'evisa-khairrin', 'ferry', 'hotel-families', 'insurance-zurich'],
  intan: ['arrival-khairrin-intan-dedi-azilah', 'esim-intan', 'esim-khairrin', 'evisa-intan', 'evisa-khairrin', 'ferry', 'hotel-families', 'insurance-zurich'],
  dedi: ['arrival-khairrin-intan-dedi-azilah', 'esim-azilah', 'esim-dedi', 'evisa-azilah', 'evisa-dedi', 'ferry', 'hotel-families', 'insurance-zurich'],
  azilah: ['arrival-khairrin-intan-dedi-azilah', 'esim-azilah', 'esim-dedi', 'evisa-azilah', 'evisa-dedi', 'ferry', 'hotel-families', 'insurance-zurich'],
  badiuz: ['arrival-badiuz-family', 'esim-nasuha', 'evisa-badiuz', 'evisa-nasuha', 'evisa-nayla', 'ferry', 'hotel-families', 'insurance-takaful'],
  nasuha: ['arrival-badiuz-family', 'esim-nasuha', 'evisa-badiuz', 'evisa-nasuha', 'evisa-nayla', 'ferry', 'hotel-families', 'insurance-takaful'],
};

test('the participant and traveller matrix is complete', () => {
  assert.equal(Object.keys(BATAM_ACCOUNTS).length, 8);
  assert.equal(Object.keys(BATAM_TRAVELLERS).length, 9);
  assert.deepEqual(Object.keys(BATAM_ACCOUNTS).sort(), Object.keys(expectedMembers).sort());
  assert.ok(BATAM_TRAVELLERS.nayla, 'Nayla must exist as a linked traveller without a login account');
});

for (const [username, memberIds] of Object.entries(expectedMembers)) {
  test(`${username} receives the correct personal or linked-family profile`, () => {
    const profile = profileForAccount(username);
    assert.ok(profile);
    assert.deepEqual(profile.members.map(({ id }) => id), memberIds);
    assert.equal(profile.username, username);
    for (const member of profile.members) {
      for (const field of ['name', 'phone', 'passport', 'arrivalCard', 'evisa', 'ferryOutbound', 'ferryReturn', 'insurance', 'room', 'esim']) assert.ok(member[field], `${member.id}.${field} is required`);
    }
  });

  test(`${username} receives only the intended travel documents`, () => {
    const profile = profileForAccount(username);
    const ids = profile.documents.map(({ id }) => id).sort();
    assert.deepEqual(ids, expectedCoreDocuments[username].sort());
    for (const document of profile.documents) assert.ok(documentForAccount(username, document.id), `${username} must be authorized for ${document.id}`);
    assert.equal(JSON.stringify(profile).includes('driveId'), false, 'Drive IDs must not be exposed in profile JSON');
    assert.equal(Object.hasOwn(profile, 'pin'), false, 'PIN properties must not be exposed in profile JSON');
    assert.equal(profile.members.some((member) => Object.hasOwn(member, 'pin')), false, 'PIN properties must not be exposed on travellers');
  });
}

test('linked-family usernames resolve to the same members and document wallet', () => {
  for (const [left, right] of [['khairrin', 'intan'], ['dedi', 'azilah'], ['badiuz', 'nasuha']]) {
    const a = profileForAccount(left); const b = profileForAccount(right);
    assert.deepEqual(a.members, b.members);
    assert.deepEqual(a.documents, b.documents);
  }
});

test('documents cannot cross participant or family boundaries', () => {
  const snapshot = adminSnapshot();
  for (const account of snapshot.accounts) {
    for (const document of snapshot.documents) {
      const expected = document.members.some((id) => account.memberIds.includes(id));
      assert.equal(Boolean(documentForAccount(account.username, document.id)), expected, `${account.username} access mismatch for ${document.id}`);
    }
  }
});

test('admin snapshot is complete and does not expose login PINs or Drive IDs', () => {
  const snapshot = adminSnapshot(); const serialized = JSON.stringify(snapshot);
  assert.equal(snapshot.trip.travellers, 9);
  assert.equal(snapshot.trip.accounts, 8);
  assert.equal(snapshot.travellers.length, 9);
  assert.equal(snapshot.accounts.length, 8);
  assert.equal(snapshot.documents.length, 25);
  assert.equal(serialized.includes('driveId'), false);
  for (const account of Object.values(BATAM_ACCOUNTS)) assert.equal(serialized.includes(`"pin":"${account.pin}"`), false);
});

test('nonexistent accounts and unknown documents are denied', () => {
  assert.equal(profileForAccount('unknown'), null);
  assert.equal(documentForAccount('unknown', 'ferry'), null);
  assert.equal(documentForAccount('aniq', 'evisa-faisal'), null);
  assert.equal(documentForAccount('faisal', 'arrival-aniq'), null);
});

test('family profile accordion closes the previously expanded card content', () => {
  const source = readFileSync(new URL('../src/pages/batam.astro', import.meta.url), 'utf8');
  assert.match(source, /const disclosureContent = new WeakMap\(\)/);
  assert.match(source, /disclosureContent\.set\(container, content\)/);
  assert.match(source, /const otherContent = disclosureContent\.get\(other\)/);
  assert.match(source, /other\.classList\.remove\('is-open'\)/);
  assert.match(source, /otherContent instanceof HTMLElement\) otherContent\.hidden = true/);
});

test('document previews use the offline custom viewer for PDFs and supported images', () => {
  const source = readFileSync(new URL('../src/pages/batam.astro', import.meta.url), 'utf8');
  assert.match(source, /import \* as pdfjs from 'pdfjs-dist\/legacy\/build\/pdf\.mjs'/);
  assert.match(source, /pdfjs\.getDocument\(\{ data: new Uint8Array\(bytes\) \}\)/);
  assert.match(source, /contentType\.startsWith\('image\/'\)/);
  assert.doesNotMatch(source, /createElement\('iframe'\)/);
  assert.match(source, /cache\.put\(pdfWorkerUrl, workerResponse\)/);
  assert.match(source, /document\.body\.append\(viewer\)/);
  assert.match(source, /card\.append\(viewer\); button\.textContent = 'Close preview';\s*setExpanded\(true\)/);
  assert.match(source, /fullscreen\.addEventListener\('click', dispose\)/);
});

test('the Batam service worker cannot cache or serve public-site navigations', () => {
  const page = readFileSync(new URL('../src/pages/batam.astro', import.meta.url), 'utf8');
  const worker = readFileSync(new URL('../public/batam-sw.js', import.meta.url), 'utf8');
  assert.match(page, /scope: '\/batam\/'/);
  assert.match(page, /scriptPath === '\/batam-sw\.js' && scopePath === '\/'/);
  assert.match(worker, /if \(!url\.pathname\.startsWith\('\/batam'\)\) return/);
  assert.match(worker, /const SHELL = 'batam-shell-v4'/);
});
