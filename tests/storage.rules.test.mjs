import { after, before, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage';

const PROJECT_ID = 'demo-aniqsaidi';
const ADMIN_UID = '1Mhzu5HmjdU82yzGlph6gQHX1843';
let environment;

before(async () => {
  const rules = await readFile(new URL('../storage.rules', import.meta.url), 'utf8');
  environment = await initializeTestEnvironment({ projectId: PROJECT_ID, storage: { rules } });
});
after(async () => environment?.cleanup());

test('public assets are readable while anonymous uploads are denied', async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await uploadBytes(ref(context.storage(), 'public/media/readable/display.webp'), new Uint8Array([1, 2, 3]), { contentType: 'image/webp' });
  });
  const publicStorage = environment.unauthenticatedContext().storage();
  await assertSucceeds(getBytes(ref(publicStorage, 'public/media/readable/display.webp')));
  await assertFails(uploadBytes(ref(publicStorage, 'public/media/nope/display.webp'), new Uint8Array([1]), { contentType: 'image/webp' }));
});

test('only the approved UID may upload valid images and PDFs', async () => {
  const wrong = environment.authenticatedContext('wrong-uid').storage();
  await assertFails(uploadBytes(ref(wrong, 'public/media/wrong/display.webp'), new Uint8Array([1]), { contentType: 'image/webp' }));
  const admin = environment.authenticatedContext(ADMIN_UID).storage();
  await assertSucceeds(uploadBytes(ref(admin, 'public/media/image/display.webp'), new Uint8Array([1, 2]), { contentType: 'image/webp' }));
  await assertSucceeds(uploadBytes(ref(admin, 'public/media/pdf/document.pdf'), new Uint8Array([1, 2]), { contentType: 'application/pdf' }));
  await assertFails(uploadBytes(ref(admin, 'public/media/script/payload.js'), new Uint8Array([1]), { contentType: 'text/javascript' }));
});

test('oversized files are denied and immutable résumé versions cannot be overwritten', async () => {
  const admin = environment.authenticatedContext(ADMIN_UID).storage();
  await assertFails(uploadBytes(ref(admin, 'public/media/huge/display.webp'), new Uint8Array(12 * 1024 * 1024 + 1), { contentType: 'image/webp' }));
  const version = ref(admin, 'public/resume/versions/version-1.pdf');
  await assertSucceeds(uploadBytes(version, new Uint8Array([1, 2]), { contentType: 'application/pdf' }));
  await assertFails(uploadBytes(version, new Uint8Array([3, 4]), { contentType: 'application/pdf' }));
  await assertSucceeds(deleteObject(version));
});
