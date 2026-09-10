import assert from 'node:assert/strict';
import test from 'node:test';
import { adminSnapshot, BATAM_ACCOUNTS, BATAM_TRAVELLERS, documentForAccount, profileForAccount } from '../functions/batam-trip.mjs';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import {
  cleanupLegacyBatamServiceWorkers,
  isLegacyBatamRegistration,
  registerBatamServiceWorker,
} from '../src/scripts/batamServiceWorker.js';

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

test('legacy Batam registration detection requires the old script and root scope', () => {
  const registration = (scriptPath, scopePath, state = 'active') => ({
    [state]: { scriptURL: `https://aniqsaidi.my${scriptPath}` },
    scope: `https://aniqsaidi.my${scopePath}`,
  });

  assert.equal(isLegacyBatamRegistration(registration('/batam-sw.js', '/')), true);
  assert.equal(isLegacyBatamRegistration(registration('/batam-sw.js', '/', 'waiting')), true);
  assert.equal(isLegacyBatamRegistration(registration('/batam-sw.js', '/batam/')), false);
  assert.equal(isLegacyBatamRegistration(registration('/batam/sw.js', '/batam/')), false);
  assert.equal(isLegacyBatamRegistration(registration('/another-sw.js', '/')), false);
});

test('public cleanup unregisters only root-scoped legacy workers and removes only Batam shell caches', async () => {
  const unregistered = [];
  const deletedCaches = [];
  const registration = (scriptPath, scopePath) => ({
    active: { scriptURL: `https://aniqsaidi.my${scriptPath}` },
    scope: `https://aniqsaidi.my${scopePath}`,
    unregister: async () => { unregistered.push(`${scriptPath}:${scopePath}`); return true; },
  });
  const registrations = [
    registration('/batam-sw.js', '/'),
    registration('/batam-sw.js', '/batam/'),
    registration('/another-sw.js', '/'),
  ];
  const cacheStorage = {
    keys: async () => ['batam-shell-v3', 'batam-shell-v4', 'portfolio-assets'],
    delete: async (key) => { deletedCaches.push(key); return true; },
  };

  assert.equal(await cleanupLegacyBatamServiceWorkers({ getRegistrations: async () => registrations }, cacheStorage), true);
  assert.deepEqual(unregistered, ['/batam-sw.js:/']);
  assert.deepEqual(deletedCaches, ['batam-shell-v3', 'batam-shell-v4']);
});

test('cleanup leaves caches untouched when no root-scoped legacy worker exists', async () => {
  let cacheReads = 0;
  const registration = {
    active: { scriptURL: 'https://aniqsaidi.my/batam-sw.js' },
    scope: 'https://aniqsaidi.my/batam/',
  };
  const cleaned = await cleanupLegacyBatamServiceWorkers(
    { getRegistrations: async () => [registration] },
    { keys: async () => { cacheReads += 1; return []; } },
  );

  assert.equal(cleaned, false);
  assert.equal(cacheReads, 0);
});

test('the public layout runs legacy cleanup inline before bundled page scripts', () => {
  const layout = readFileSync(new URL('../src/layouts/Layout.astro', import.meta.url), 'utf8');
  const cleanupStart = layout.indexOf("navigator.serviceWorker.getRegistrations()");
  const bundledScriptStart = layout.indexOf("import { sfx, bindSfx }");

  assert.ok(cleanupStart > -1, 'public layout must contain the recovery hook');
  assert.ok(cleanupStart < bundledScriptStart, 'recovery hook must run before bundled scripts');
  assert.match(layout, /worker\.scriptURL\)\.pathname === '\/batam-sw\.js'/);
  assert.match(layout, /registration\.scope\)\.pathname === '\/'/);
  assert.match(layout, /key\.startsWith\('batam-shell-'\)/);
});

test('Batam registration uses the relocated worker and restricted scope', async () => {
  const calls = [];
  const serviceWorker = {
    getRegistrations: async () => [],
    register: async (...args) => {
      calls.push(args);
      return { update: async () => { calls.push(['update']); } };
    },
  };

  await registerBatamServiceWorker(serviceWorker);
  assert.deepEqual(calls, [
    ['/batam/sw.js', { scope: '/batam/', updateViaCache: 'none' }],
    ['update'],
  ]);
});

test('the Batam worker handles Batam paths and ignores every public-site request', () => {
  const workerSource = readFileSync(new URL('../public/batam/sw.js', import.meta.url), 'utf8');
  const listeners = {};
  const context = {
    URL,
    location: { origin: 'https://aniqsaidi.my' },
    self: {
      location: { origin: 'https://aniqsaidi.my' },
      addEventListener: (name, listener) => { listeners[name] = listener; },
      skipWaiting: () => {},
      clients: { claim: () => {} },
    },
    caches: {
      open: async () => ({ put: async () => {} }),
      match: async () => undefined,
    },
    fetch: async () => ({ ok: true, clone: () => ({}) }),
  };
  vm.runInNewContext(workerSource, context);

  const isIntercepted = (pathname) => {
    let intercepted = false;
    listeners.fetch({
      request: {
        url: `https://aniqsaidi.my${pathname}`,
        method: 'GET',
        mode: 'navigate',
      },
      respondWith: () => { intercepted = true; },
    });
    return intercepted;
  };

  for (const pathname of ['/', '/about', '/projects', '/experience', '/certifications', '/awards', '/leadership', '/archives', '/_astro/example.css', '/_astro/example.js', '/favicon.png']) {
    assert.equal(isIntercepted(pathname), false, `${pathname} must not be intercepted`);
  }
  for (const pathname of ['/batam', '/batam/', '/batam/admin']) {
    assert.equal(isIntercepted(pathname), true, `${pathname} should be handled`);
  }
});
