import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('every non-project repeatable CMS collection has a public render target', async () => {
  const [about, experience, certifications, awards, leadership, archives] = await Promise.all([
    source('src/pages/about.astro'),
    source('src/pages/experience.astro'),
    source('src/pages/certifications.astro'),
    source('src/pages/awards.astro'),
    source('src/pages/leadership.astro'),
    source('src/pages/archives/index.astro'),
  ]);

  assert.match(about, /data-cms-collection="about\.education"/);
  assert.match(experience, /data-cms-collection="experience\.jobs"/);
  assert.match(experience, /data-cms-collection="experience\.toolkit"/);
  assert.match(certifications, /data-cms-collection="certifications\.certifications"/);
  assert.match(awards, /data-cms-collection="awards\.awards"/);
  assert.match(leadership, /data-cms-collection="leadership\.leadership"/);
  assert.match(archives, /data-archive-panels/);
});

test('the shared renderer dispatches every structured public page it owns', async () => {
  const renderer = await source('src/scripts/publicCmsRender.ts');
  for (const page of ['about', 'experience', 'certifications', 'awards', 'leadership', 'archives']) {
    assert.match(renderer, new RegExp(`pageId === '${page}'`));
  }
  assert.match(renderer, /status === 'published'/);
  assert.match(renderer, /sortOrder/);
});

test('home rebuilds repeatable queues and calls to action from cmsPublished', async () => {
  const home = await source('src/pages/index.astro');
  assert.match(home, /cmsPublished', 'home'/);
  assert.match(home, /actions\.replaceChildren/);
  assert.match(home, /grid\.replaceChildren/);
});

test('structured publishing is not blocked by fixed legacy v1 collection shapes', async () => {
  const admin = await source('src/scripts/adminCms.ts');
  assert.doesNotMatch(admin, /transaction\.set\(doc\(services\.db, 'siteContent'/);
  assert.match(admin, /PUBLISH FAILED \/\/ \$\{errorCode\(error\)\}/);
});
