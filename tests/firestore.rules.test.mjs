import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { CMS_PAGE_IDS, migrateV1ToV2 } from '../src/data/cmsSchema.ts';
import { defaultSeoDocument } from '../src/data/cmsEditorial.ts';

const PROJECT_ID = 'demo-aniqsaidi';
const ADMIN_UID = '1Mhzu5HmjdU82yzGlph6gQHX1843';
let environment;
let snapshot;
let v2Pages;

const homeData = () => {
  const data = structuredClone(snapshot.documents.home.data);
  delete data.publishedAt;
  delete data.updatedAt;
  return data;
};

const pagesData = () => {
  const data = structuredClone(snapshot.documents.pages.data);
  delete data.publishedAt;
  delete data.updatedAt;
  return data;
};

const publishedHome = () => ({
  ...homeData(),
  publishedAt: serverTimestamp(),
});

const publishedPages = () => ({
  ...pagesData(),
  publishedAt: serverTimestamp(),
});

before(async () => {
  const [rules, snapshotText] = await Promise.all([
    readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
    readFile(new URL('../backups/site-content-v1-2026-08-05.json', import.meta.url), 'utf8'),
  ]);
  snapshot = JSON.parse(snapshotText);
  v2Pages = migrateV1ToV2(homeData(), pagesData().fields);
  environment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules },
  });
});

beforeEach(async () => {
  await environment.clearFirestore();
});

after(async () => {
  await environment?.cleanup();
});

test('published content is publicly readable', async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'siteContent', 'home'), publishedHome());
  });
  const publicDb = environment.unauthenticatedContext().firestore();
  const result = await assertSucceeds(getDoc(doc(publicDb, 'siteContent', 'home')));
  assert.equal(result.exists(), true);
});

test('unauthenticated users cannot read drafts or write published content', async () => {
  const publicDb = environment.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(publicDb, 'siteDrafts', 'home')));
  await assertFails(setDoc(doc(publicDb, 'siteContent', 'home'), publishedHome()));
});

test('a verified matching email with the wrong UID is denied', async () => {
  const wrongUserDb = environment.authenticatedContext('wrong-uid', {
    email: 'aniqsaidi.official@gmail.com',
    email_verified: true,
  }).firestore();
  await assertFails(setDoc(doc(wrongUserDb, 'siteDrafts', 'home'), publishedHome()));
});

test('the approved UID can atomically write valid v1 documents', async () => {
  const adminDb = environment.authenticatedContext(ADMIN_UID).firestore();
  const batch = writeBatch(adminDb);
  batch.set(doc(adminDb, 'siteContent', 'home'), publishedHome());
  batch.set(doc(adminDb, 'siteDrafts', 'home'), {
    ...homeData(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(adminDb, 'siteContent', 'pages'), publishedPages());
  batch.set(doc(adminDb, 'siteDrafts', 'pages'), {
    ...pagesData(),
    updatedAt: serverTimestamp(),
  });
  await assertSucceeds(batch.commit());
});

test('invalid or unexpected v1 fields are rejected', async () => {
  const adminDb = environment.authenticatedContext(ADMIN_UID).firestore();
  await assertFails(setDoc(doc(adminDb, 'siteContent', 'home'), {
    ...publishedHome(),
    injected: 'not allowed',
  }));

  const invalidPages = publishedPages();
  delete invalidPages.fields['about.name'];
  await assertFails(setDoc(doc(adminDb, 'siteContent', 'pages'), invalidPages));
});

test('even the approved UID cannot delete published content', async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'siteContent', 'home'), publishedHome());
  });
  const adminDb = environment.authenticatedContext(ADMIN_UID).firestore();
  await assertFails(deleteDoc(doc(adminDb, 'siteContent', 'home')));
});

test('published v2 pages are public while sensitive projects and all drafts remain private', async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'cmsPublished', 'about'), {
      ...v2Pages.about,
      publishedAt: serverTimestamp(),
      updatedBy: ADMIN_UID,
    });
    await setDoc(doc(context.firestore(), 'cmsPublished', 'projects'), {
      ...v2Pages.projects, publishedAt: serverTimestamp(), updatedBy: ADMIN_UID,
    });
  });
  const publicDb = environment.unauthenticatedContext().firestore();
  const published = await assertSucceeds(getDoc(doc(publicDb, 'cmsPublished', 'about')));
  assert.equal(published.exists(), true);
  await assertFails(getDoc(doc(publicDb, 'cmsPublished', 'projects')));
  await assertFails(getDoc(doc(publicDb, 'cmsDrafts', 'about')));
  const adminDb = environment.authenticatedContext(ADMIN_UID).firestore();
  await assertSucceeds(getDoc(doc(adminDb, 'cmsPublished', 'projects')));
});

test('approved UID can atomically create every page-scoped v2 draft and published document', async () => {
  const adminDb = environment.authenticatedContext(ADMIN_UID).firestore();
  const batch = writeBatch(adminDb);
  for (const pageId of CMS_PAGE_IDS) {
    batch.set(doc(adminDb, 'cmsDrafts', pageId), {
      ...v2Pages[pageId], updatedAt: serverTimestamp(), updatedBy: ADMIN_UID, version: 1,
    });
    batch.set(doc(adminDb, 'cmsPublished', pageId), {
      ...v2Pages[pageId], publishedAt: serverTimestamp(), updatedBy: ADMIN_UID, version: 1,
    });
  }
  await assertSucceeds(batch.commit());
});

test('v2 rules reject wrong UIDs, mismatched page IDs, and unexpected fields', async () => {
  const wrongDb = environment.authenticatedContext('wrong-uid').firestore();
  await assertFails(setDoc(doc(wrongDb, 'cmsDrafts', 'about'), {
    ...v2Pages.about, updatedAt: serverTimestamp(), updatedBy: 'wrong-uid',
  }));

  const adminDb = environment.authenticatedContext(ADMIN_UID).firestore();
  await assertFails(setDoc(doc(adminDb, 'cmsDrafts', 'about'), {
    ...v2Pages.about, pageId: 'home', updatedAt: serverTimestamp(), updatedBy: ADMIN_UID,
  }));
  await assertFails(setDoc(doc(adminDb, 'cmsDrafts', 'about'), {
    ...v2Pages.about, injected: true, updatedAt: serverTimestamp(), updatedBy: ADMIN_UID,
  }));
});

test('revision history is private, immutable, and tied to its page and approved editor', async () => {
  const revisionId = 'about-draft-1';
  const revision = {
    revisionId,
    pageId: 'about',
    state: 'draft',
    content: v2Pages.about,
    summary: 'Draft saved',
    note: '',
    editorUid: ADMIN_UID,
    editorEmail: 'aniqsaidi.official@gmail.com',
    createdAt: serverTimestamp(),
    previousPublishedRevisionId: '',
  };
  const adminDb = environment.authenticatedContext(ADMIN_UID).firestore();
  const batch = writeBatch(adminDb);
  batch.set(doc(adminDb, 'cmsDrafts', 'about'), {
    ...v2Pages.about,
    updatedAt: serverTimestamp(),
    updatedBy: ADMIN_UID,
    version: 1,
    draftRevisionId: revisionId,
  });
  batch.set(doc(adminDb, 'cmsRevisions', 'about', 'items', revisionId), revision);
  await assertSucceeds(batch.commit());

  const publicDb = environment.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(publicDb, 'cmsRevisions', 'about', 'items', revisionId)));
  await assertFails(updateDoc(doc(adminDb, 'cmsRevisions', 'about', 'items', revisionId), { summary: 'History rewritten' }));
  await assertFails(setDoc(doc(adminDb, 'cmsRevisions', 'home', 'items', revisionId), revision));
});

test('phase C metadata rejects invalid versions and foreign revision pointers', async () => {
  const adminDb = environment.authenticatedContext(ADMIN_UID).firestore();
  await assertFails(setDoc(doc(adminDb, 'cmsDrafts', 'home'), {
    ...v2Pages.home,
    updatedAt: serverTimestamp(),
    updatedBy: ADMIN_UID,
    version: 0,
    draftRevisionId: 'home-draft-invalid',
  }));
  await assertFails(setDoc(doc(adminDb, 'cmsPublished', 'home'), {
    ...v2Pages.home,
    updatedAt: serverTimestamp(),
    publishedAt: serverTimestamp(),
    updatedBy: 'another-user',
    version: 1,
    publishedRevisionId: 'home-published-invalid',
  }));
});

const validMedia = () => ({
  id: 'asset-1', kind: 'profile', fileName: 'portrait.png', storagePath: 'public/media/asset-1/display.webp',
  originalStoragePath: 'public/media/asset-1/original', thumbnailStoragePath: 'public/media/asset-1/thumbnail.webp',
  publicUrl: 'https://example.test/display.webp', originalUrl: 'https://example.test/original', thumbnailUrl: 'https://example.test/thumb.webp',
  mimeType: 'image/webp', originalMimeType: 'image/png', fileSize: 1000, originalFileSize: 2000,
  width: 1200, height: 630, altText: 'Portrait of Aniq', caption: '', credit: '', usageReferences: [],
  uploadedAt: serverTimestamp(), uploadedBy: ADMIN_UID, updatedAt: serverTimestamp(),
});

test('media catalogue is admin-only and validates exact metadata', async () => {
  const publicDb = environment.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(publicDb, 'cmsMedia', 'asset-1')));
  const adminDb = environment.authenticatedContext(ADMIN_UID).firestore();
  await assertSucceeds(setDoc(doc(adminDb, 'cmsMedia', 'asset-1'), validMedia()));
  await assertFails(setDoc(doc(adminDb, 'cmsMedia', 'asset-2'), { ...validMedia(), id: 'asset-2', injected: true }));
  await assertSucceeds(deleteDoc(doc(adminDb, 'cmsMedia', 'asset-1')));
});

test('published SEO and résumé are public while drafts stay private', async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'cmsSeo', 'published'), {
      ...defaultSeoDocument, version: 1, updatedAt: serverTimestamp(), publishedAt: serverTimestamp(), updatedBy: ADMIN_UID,
    });
    await setDoc(doc(context.firestore(), 'cmsResume', 'published'), {
      schemaVersion: 1, mediaId: 'resume-1', fileName: 'resume.pdf', publicUrl: 'https://example.test/resume.pdf',
      fileSize: 1000, versionLabel: '2026-08', updatedDate: '2026-08-08', version: 1,
      updatedAt: serverTimestamp(), publishedAt: serverTimestamp(), updatedBy: ADMIN_UID,
    });
  });
  const publicDb = environment.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(publicDb, 'cmsSeo', 'published')));
  await assertSucceeds(getDoc(doc(publicDb, 'cmsResume', 'published')));
  await assertFails(getDoc(doc(publicDb, 'cmsSeo', 'draft')));
  await assertFails(getDoc(doc(publicDb, 'cmsResume', 'draft')));
});

test('approved UID can save valid editorial drafts but malformed documents are rejected', async () => {
  const adminDb = environment.authenticatedContext(ADMIN_UID).firestore();
  await assertSucceeds(setDoc(doc(adminDb, 'cmsSeo', 'draft'), {
    ...defaultSeoDocument, version: 1, updatedAt: serverTimestamp(), updatedBy: ADMIN_UID,
  }));
  await assertFails(setDoc(doc(adminDb, 'cmsSeo', 'draft'), {
    ...defaultSeoDocument, version: 0, updatedAt: serverTimestamp(), updatedBy: ADMIN_UID,
  }));
  await assertSucceeds(setDoc(doc(adminDb, 'cmsResume', 'draft'), {
    schemaVersion: 1, mediaId: 'resume-1', fileName: 'resume.pdf', publicUrl: 'https://example.test/resume.pdf',
    fileSize: 1000, versionLabel: '2026-08', updatedDate: '2026-08-08', version: 1,
    updatedAt: serverTimestamp(), updatedBy: ADMIN_UID,
  }));
});

test('versioned CMS documents reject stale overwrites and accept the next version', async () => {
  const adminDb = environment.authenticatedContext(ADMIN_UID).firestore();
  const ref = doc(adminDb, 'cmsDrafts', 'about');
  const base = { ...v2Pages.about, updatedAt: serverTimestamp(), updatedBy: ADMIN_UID, version: 1 };
  await assertSucceeds(setDoc(ref, base));
  await assertFails(setDoc(ref, { ...base, updatedAt: serverTimestamp(), version: 1 }));
  await assertSucceeds(setDoc(ref, { ...base, updatedAt: serverTimestamp(), version: 2 }));
  await assertFails(setDoc(ref, { ...base, updatedAt: serverTimestamp(), version: 4 }));
});

test('audit events are private and immutable', async () => {
  const auditId = 'draft-save-1';
  const audit = {
    id: auditId, action: 'draft.save', entityType: 'page', entityId: 'home', actorUid: ADMIN_UID,
    actorEmail: 'aniqsaidi.official@gmail.com', summary: 'Saved home draft', revisionId: 'home-draft-1', timestamp: serverTimestamp(),
  };
  const adminDb = environment.authenticatedContext(ADMIN_UID).firestore();
  const auditRef = doc(adminDb, 'cmsAudit', auditId);
  await assertSucceeds(setDoc(auditRef, audit));
  await assertFails(updateDoc(auditRef, { summary: 'Rewritten event' }));
  await assertFails(deleteDoc(auditRef));
  await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), 'cmsAudit', auditId)));
});

test('pre-import backups are admin-only and immutable', async () => {
  const backupId = 'pre-import-test';
  const backup = {
    id: backupId, schemaVersion: 1, createdAt: serverTimestamp(), actorUid: ADMIN_UID,
    actorEmail: 'aniqsaidi.official@gmail.com', reason: 'Pre-import backup', pages: { home: v2Pages.home },
    seo: defaultSeoDocument, resume: { schemaVersion: 1 }, mediaManifest: [], sourceVersions: { 'draft.home': 1 },
  };
  const adminDb = environment.authenticatedContext(ADMIN_UID).firestore();
  const backupRef = doc(adminDb, 'cmsBackups', backupId);
  await assertSucceeds(setDoc(backupRef, backup));
  await assertFails(updateDoc(backupRef, { reason: 'Changed' }));
  await assertFails(deleteDoc(backupRef));
  await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), 'cmsBackups', backupId)));
});
