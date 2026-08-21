import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const publicPages = ['', 'about', 'projects', 'experience', 'certifications', 'awards', 'leadership', 'archives', 'resume/requested'];
const htmlFor = (route) => readFile(new URL(`../dist/${route ? `${route}/` : ''}index.html`, import.meta.url), 'utf8');

test('public pages expose a single labelled main landmark and keyboard skip link', async () => {
  for (const route of publicPages) {
    const html = await htmlFor(route);
    assert.equal((html.match(/<main\b/g) ?? []).length, 1, `${route || 'home'} must have one main landmark`);
    assert.match(html, /<main[^>]*id="main-content"[^>]*tabindex="-1"/);
    assert.match(html, /<a[^>]*class="skip-link"[^>]*href="#main-content"/);
    assert.match(html, /<nav[^>]*aria-label=/);
  }
});

test('generated pages do not contain duplicate ids or unlabelled images', async () => {
  for (const route of publicPages) {
    const html = await htmlFor(route);
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, `${route || 'home'} contains duplicate ids`);
    for (const image of html.match(/<img\b[^>]*>/g) ?? []) assert.match(image, /\salt="[^"]*"/);
  }
});

test('interactive controls have explicit button types and admin pages remain private', async () => {
  for (const route of [...publicPages, 'admin']) {
    const html = await htmlFor(route);
    for (const button of html.match(/<button\b[^>]*>/g) ?? []) assert.match(button, /\stype="button"/);
  }
  const admin = await htmlFor('admin');
  assert.match(admin, /<meta name="robots" content="noindex, nofollow, noarchive">/);
  assert.match(admin, /<iframe[^>]*title="Public page preview"/);
  const requested = await htmlFor('resume/requested');
  assert.match(requested, /<meta name="robots" content="noindex, nofollow, noarchive">/);
});

test('reduced-motion and visible-focus safeguards are present', async () => {
  const css = await readFile(new URL('../src/styles/terminal.css', import.meta.url), 'utf8');
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /\.skip-link:focus/);
});

test('content pages expose one standardized sort control while home and about remain unsorted', async () => {
  const sortablePages = ['projects', 'experience', 'certifications', 'awards', 'leadership', 'archives'];
  for (const route of sortablePages) {
    const html = await htmlFor(route);
    assert.equal((html.match(/data-sort-control=/g) ?? []).length, 1, `${route} must have one sort control`);
    assert.match(html, new RegExp(`data-sort-scope="${route}"`));
    assert.match(html, /<option value="latest" selected>Latest first<\/option>|<option value="latest">LATEST FIRST<\/option>/i);
    assert.match(html, /<option value="oldest">OLDEST FIRST<\/option>/i);
  }
  for (const route of ['', 'about']) {
    const html = await htmlFor(route);
    assert.doesNotMatch(html, /data-sort-control=/, `${route || 'home'} must not expose a sort control`);
  }
});
