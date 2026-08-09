import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CMS_PAGE_IDS,
  cmsV2ToV1,
  defaultProjects,
  migrateV1ToV2,
  stableId,
  validateCmsPage,
  validateCmsPages,
} from '../src/data/cmsSchema.ts';
import {
  changedPageIds,
  pageContent,
  pagesMatch,
  preparePublishedPage,
} from '../src/data/cmsWorkflow.ts';

const snapshot = JSON.parse(await readFile(new URL('../backups/site-content-v1-2026-08-05.json', import.meta.url), 'utf8'));
const home = structuredClone(snapshot.documents.home.data);
const fields = structuredClone(snapshot.documents.pages.data.fields);
delete home.publishedAt;

test('v1 content migrates into all eight page-scoped v2 documents', () => {
  const pages = migrateV1ToV2(home, fields);
  assert.deepEqual(Object.keys(pages), CMS_PAGE_IDS);
  for (const pageId of CMS_PAGE_IDS) {
    assert.equal(pages[pageId].schemaVersion, 2);
    assert.equal(pages[pageId].pageId, pageId);
  }
  assert.equal(validateCmsPages(pages).length, 0);
});

test('migration preserves every existing repeatable record', () => {
  const pages = migrateV1ToV2(home, fields);
  assert.equal(pages.home.data.queue.length, 4);
  assert.equal(pages.about.data.education.length, 3);
  assert.equal(pages.experience.data.jobs.length, 4);
  assert.equal(pages.experience.data.toolkit.length, 5);
  assert.equal(pages.certifications.data.certifications.length, 10);
  assert.equal(pages.awards.data.awards.length, 9);
  assert.equal(pages.leadership.data.leadership.length, 8);
  assert.equal(pages.archives.data.articles.length, 9);
});

test('migration seeds three curated highlights for recognition pages', () => {
  const pages = migrateV1ToV2(home, fields);
  assert.deepEqual(
    pages.certifications.data.certifications.filter((item) => item.featured).map((item) => item.title),
    ['Professional Scrum Master I', 'Tableau 2024.1: Essential Training', 'AWS Partner: Security Best Practices (Technical)'],
  );
  assert.deepEqual(
    pages.awards.data.awards.filter((item) => item.featured).map((item) => item.title),
    ['Fujitsu Certificate of Excellence', 'Fujitsu Best Performer Award', 'CITREx 2020 Silver Medal'],
  );
  assert.deepEqual(
    pages.leadership.data.leadership.filter((item) => item.featured).map((item) => item.role),
    [
      'President, Student Representative Council - UMPSA',
      'Third Vice-President, National Student Consultative Council',
      'Director - SRC International Community Service Program',
    ],
  );
});

test('stable IDs are deterministic and independent from array position', () => {
  const first = migrateV1ToV2(home, fields);
  const second = migrateV1ToV2(home, fields);
  assert.equal(first.experience.data.jobs[0].id, second.experience.data.jobs[0].id);
  assert.equal(stableId('experience', 'same record'), stableId('experience', 'same record'));
  first.experience.data.jobs.reverse();
  assert.ok(first.experience.data.jobs.some((job) => job.id === second.experience.data.jobs[0].id));
});

test('projects and ordered case-study sections are first-class draft records', () => {
  const pages = migrateV1ToV2(home, fields);
  assert.equal(pages.projects.data.projects.length, 10);
  assert.equal(defaultProjects[0].slug, 'patient-management-platform');
  assert.ok(defaultProjects[0].sections.length >= 7);
  assert.ok(defaultProjects.every((project) => project.status === 'draft'));
  assert.ok(defaultProjects.every((project) => project.confidentialityNote.length > 0));
  assert.ok(defaultProjects.filter((project) => project.referenceUrl).every((project) => project.referenceUrl.startsWith('https://')));
});

test('v2 converts back to the current v1 public compatibility shape without content loss', () => {
  const pages = migrateV1ToV2(home, fields);
  const legacy = cmsV2ToV1(pages);
  assert.equal(legacy.home.profile.greeting, home.profile.greeting);
  assert.equal(legacy.home.queue.length, 4);
  assert.equal(legacy.fields['experience.jobs.0.role'], fields['experience.jobs.0.role']);
  assert.equal(legacy.fields['certifications.9.title'], fields['certifications.9.title']);
  assert.equal(legacy.fields['archives.watikah.description'], fields['archives.watikah.description']);
});

test('schema validation rejects duplicate IDs and missing required fields', () => {
  const pages = migrateV1ToV2(home, fields);
  pages.awards.data.awards[1].id = pages.awards.data.awards[0].id;
  pages.awards.data.awards[0].title = '';
  const issues = validateCmsPage(pages.awards);
  assert.ok(issues.some((issue) => issue.message.includes('unique')));
  assert.ok(issues.some((issue) => issue.message.includes('required')));
});

test('nested repeaters and public slugs are validated', () => {
  const pages = migrateV1ToV2(home, fields);
  const project = pages.projects.data.projects[0];
  project.technologies[1].id = project.technologies[0].id;
  pages.projects.data.projects[1].slug = project.slug;
  const issues = validateCmsPage(pages.projects);
  assert.ok(issues.some((issue) => issue.path.includes('technologies') && issue.message.includes('unique')));
  assert.ok(issues.some((issue) => issue.path.includes('projects.1') && issue.message.includes('slug')));
});

test('published snapshots exclude every draft and archived record recursively', () => {
  const pages = migrateV1ToV2(home, fields);
  pages.home.data.queue[0].status = 'draft';
  pages.experience.data.jobs[0].highlights[0].status = 'archived';
  const publishedHome = preparePublishedPage(pages.home);
  const publishedExperience = preparePublishedPage(pages.experience);
  assert.equal(publishedHome.data.queue.some((item) => item.id === pages.home.data.queue[0].id), false);
  assert.equal(publishedExperience.data.jobs[0].highlights.some((item) => item.id === pages.experience.data.jobs[0].highlights[0].id), false);
  assert.equal(preparePublishedPage(pages.projects).data.projects.length, 0);
});

test('workflow comparison ignores storage metadata but detects draft content changes', () => {
  const pages = migrateV1ToV2(home, fields);
  const stored = { ...pageContent(pages.about), version: 4, updatedBy: 'admin', updatedAt: new Date() };
  assert.equal(pagesMatch(stored, pages.about), true);
  pages.about.data.role = `${pages.about.data.role} UPDATED`;
  assert.equal(pagesMatch(stored, pages.about), false);
});

test('changed page reporting is page scoped and includes unpublished draft records', () => {
  const pages = migrateV1ToV2(home, fields);
  const published = structuredClone(pages);
  assert.deepEqual(changedPageIds(pages, published), []);
  pages.projects.data.projects.push({ ...structuredClone(pages.projects.data.projects[0]), id: 'project-new-draft', slug: 'new-draft' });
  assert.deepEqual(changedPageIds(pages, published), ['projects']);
});
