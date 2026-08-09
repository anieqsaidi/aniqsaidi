import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { migrateV1ToV2 } from '../src/data/cmsSchema.ts';
import { defaultResumeDocument, defaultSeoDocument } from '../src/data/cmsEditorial.ts';
import { createExportBundle, exportFileName, validateImportBundle } from '../src/data/cmsOperations.ts';

const snapshot = JSON.parse(await readFile(new URL('../backups/site-content-v1-2026-08-05.json', import.meta.url), 'utf8'));
const pages = migrateV1ToV2(snapshot.documents.home.data, snapshot.documents.pages.data.fields);
const bundle = () => createExportBundle({
  exportedBy: 'admin@example.test', scope: 'complete', pageId: '', drafts: structuredClone(pages),
  published: structuredClone(pages), seoDraft: structuredClone(defaultSeoDocument), seoPublished: structuredClone(defaultSeoDocument),
  resumeDraft: structuredClone(defaultResumeDocument), resumePublished: structuredClone(defaultResumeDocument), mediaManifest: [], versions: {},
});

test('complete CMS exports validate for safe import', () => {
  const validation = validateImportBundle(bundle());
  assert.equal(validation.valid, true);
  assert.deepEqual(Object.keys(validation.bundle.drafts).sort(), Object.keys(pages).sort());
});

test('partial page imports receive full field validation', () => {
  const candidate = bundle();
  candidate.scope = 'page'; candidate.pageId = 'home'; candidate.drafts = { home: structuredClone(pages.home) };
  candidate.drafts.home.data.profile.greeting = '';
  const validation = validateImportBundle(candidate);
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.some((issue) => issue.path === 'drafts.home.profile.greeting'));
});

test('unknown export and schema versions are rejected', () => {
  const candidate = bundle(); candidate.exportVersion = 99; candidate.schemaVersion = 99;
  const validation = validateImportBundle(candidate);
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.some((issue) => issue.path === 'exportVersion'));
  assert.ok(validation.issues.some((issue) => issue.path === 'schemaVersion'));
});

test('export filenames are dated, scoped, and page-specific', () => {
  assert.match(exportFileName('page', 'about'), /^aniq-cms-page-about-\d{4}-\d{2}-\d{2}\.json$/);
});
