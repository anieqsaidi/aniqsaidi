import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrateV1ToV2 } from '../src/data/cmsSchema.ts';
import {
  analyzeCompleteness,
  defaultResumeDocument,
  defaultSeoDocument,
  validateMediaRecord,
  validateSeoDocument,
} from '../src/data/cmsEditorial.ts';

const snapshot = JSON.parse(await readFile(new URL('../backups/site-content-v1-2026-08-05.json', import.meta.url), 'utf8'));
const pages = migrateV1ToV2(snapshot.documents.home.data, snapshot.documents.pages.data.fields);
const media = (overrides = {}) => ({
  id: 'asset-1', kind: 'profile', fileName: 'profile.webp', storagePath: 'public/media/asset-1/display.webp',
  originalStoragePath: 'public/media/asset-1/original', thumbnailStoragePath: 'public/media/asset-1/thumbnail.webp',
  publicUrl: 'https://example.test/display.webp', originalUrl: 'https://example.test/original', thumbnailUrl: 'https://example.test/thumb.webp',
  mimeType: 'image/webp', originalMimeType: 'image/png', fileSize: 1000, originalFileSize: 2000,
  width: 1200, height: 630, altText: 'Aniq at his workstation', caption: '', credit: '', usageReferences: [], uploadedBy: 'admin',
  ...overrides,
});

test('default SEO covers every public CMS page with social imagery', () => {
  const issues = validateSeoDocument(structuredClone(defaultSeoDocument));
  assert.equal(issues.some((issue) => issue.severity === 'error'), false);
  assert.equal(issues.some((issue) => issue.path === 'socialImage'), false);
  assert.ok(Object.values(defaultSeoDocument.pages).every((page) => page.socialImage === '/social/aniq-terminal-social.png'));
});

test('SEO validation rejects duplicate titles and malformed canonical paths', () => {
  const seo = structuredClone(defaultSeoDocument);
  seo.pages.about.seoTitle = seo.pages.home.seoTitle;
  seo.pages.about.canonicalPath = 'about';
  const issues = validateSeoDocument(seo);
  assert.ok(issues.some((issue) => issue.pageId === 'about' && issue.message.includes('duplicates')));
  assert.ok(issues.some((issue) => issue.pageId === 'about' && issue.path === 'canonicalPath'));
});

test('image metadata requires alt text and warns about low resolution', () => {
  const issues = validateMediaRecord(media({ altText: '', width: 200, height: 100 }));
  assert.ok(issues.some((issue) => issue.path === 'altText'));
  assert.ok(issues.some((issue) => issue.path === 'dimensions'));
});

test('completeness reporting includes missing media references and résumé readiness', () => {
  const incompletePages = structuredClone(pages);
  incompletePages.projects.data.projects[0].thumbnail = 'missing-media-id';
  const issues = analyzeCompleteness(incompletePages, structuredClone(defaultSeoDocument), [media()], structuredClone(defaultResumeDocument));
  assert.ok(issues.some((issue) => issue.pageId === 'projects' && issue.message.includes('media')));
  assert.ok(issues.some((issue) => issue.pageId === 'resume'));
});
