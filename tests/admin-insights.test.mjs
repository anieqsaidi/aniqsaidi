import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { readFile } from 'node:fs/promises';
import { getAuth } from '../functions/node_modules/firebase-admin/lib/auth/index.js';
import { adminInsights } from '../functions/index.mjs';
import { analyticsReports, summarizeAnalytics, inspectSite, internalLinks, PUBLIC_ROUTES } from '../functions/admin-insights.mjs';
import { emptyLead, validateLead, followUpDue, malaysiaToday } from '../src/data/recruiterInbox.ts';

test('follow-ups use Malaysia dates and closed leads are not due', () => {
  assert.equal(malaysiaToday(new Date('2026-09-05T16:01:00Z')), '2026-09-06');
  assert.equal(followUpDue({ ...emptyLead, followUp: '2026-09-06' }, '2026-09-06'), true);
  assert.equal(followUpDue({ ...emptyLead, stage: 'closed', followUp: '2026-09-01' }, '2026-09-06'), false);
  assert.equal(followUpDue(emptyLead), false);
  assert.throws(() => validateLead({ ...emptyLead, followUp: '2026-02-30' }));
  assert.throws(() => validateLead({ ...emptyLead, notes: 'a'.repeat(5001) }));
  assert.throws(() => validateLead({ ...emptyLead, stage: 'invalid' }));
  assert.equal(validateLead({ ...emptyLead, followUp: '2028-02-29' }).followUp, '2028-02-29');
});

test('analytics reports share complete-day windows and exclude private paths', () => {
  const reports = analyticsReports(30);
  assert.equal(reports.length, 5);
  reports.forEach((r) => {
    assert.deepEqual(r.dateRanges, [{ startDate: '30daysAgo', endDate: 'yesterday' }]);
    assert.match(JSON.stringify(r.dimensionFilter), /admin\|batam\|api/);
  });
  assert.throws(() => analyticsReports(100000));
});

const metric = (...values) => ({ metricValues: values.map((value) => ({ value: String(value) })) });
const report = (rows = []) => ({ metricHeaders: [{ name: 'sessions' }], rows, metadata: { timeZone: 'Asia/Kuala_Lumpur' } });
test('CV rate uses sessions with submissions, never submission events divided by users', () => {
  const reports = [report([metric(10, 8, 25)]), report(), report(), report([
    { dimensionValues: [{ value: 'cv_request_submitted' }], ...metric(4, 2) },
    { dimensionValues: [{ value: 'portfolio_outbound' }], ...metric(7, 3) },
  ]), report()];
  const result = summarizeAnalytics(reports, 30);
  assert.equal(result.cvSessionRate, .2);
  assert.equal(result.cvSubmissions, 4);
  assert.equal(result.outboundClicks, 7);
  assert.equal(result.users, 8);
  reports[0].metadata.subjectToThresholding = true;
  assert.equal(summarizeAnalytics(reports, 30).limited, true);
  assert.equal(summarizeAnalytics(Array.from({ length: 5 }, () => report()), 30).cvSessionRate, null);
  assert.throws(() => summarizeAnalytics([], 30));
});

test('link discovery never probes external, private, or token-bearing endpoints', () => {
  const html = '<a href="/about/?token=secret#x">a</a><a href="https://evil.test/">b</a><a href="/api/cv/download?t=secret">c</a><a href="/batam/">d</a><a href="/admin/">e</a><a href="javascript:alert(1)">f</a><a href="//evil.test/">g</a>';
  assert.deepEqual(internalLinks(html), ['/about/']);
});

test('health checks report failures, cap work, and never claim email delivery', async () => {
  const fetched = [];
  const fetcher = async (url, options) => {
    fetched.push({ url, method: options.method });
    if (url.endsWith('/about/')) throw new Error('offline');
    if (url.endsWith('/projects/')) return new Response('', { status: 503 });
    return new Response(Array.from({ length: 60 }, (_, i) => `<a href="/resource-${i}">Link</a>`).join(''), { status: 200, headers: { 'content-type': 'text/html' } });
  };
  const result = await inspectSite({ fetcher, checkCv: async () => { throw new Error('missing'); }, checkCertificate: async () => ({ label: 'TLS certificate', state: 'pass', detail: 'test certificate' }) });
  assert.equal(result.linksChecked, 40);
  assert.equal(result.linksDiscovered, 60);
  assert.equal(fetched.length, PUBLIC_ROUTES.length + 40);
  assert.equal(result.checks.find((r) => r.label === '/projects/').state, 'fail');
  assert.equal(result.checks.find((r) => r.label === 'Published CV file').state, 'fail');
  assert.equal(result.checks.find((r) => r.label === 'Email delivery').state, 'unverified');
  assert.ok(fetched.every((item) => item.url.startsWith('https://aniqsaidi.my/')));
});

test('redirects are not marked healthy without destination verification', async () => {
  const result = await inspectSite({ fetcher: async (url) => url.endsWith('/about/') ? new Response(null, { status: 302, headers: { location: 'https://external.test/' } }) : new Response('', { status: 200 }), checkCv: async () => {}, checkCertificate: async () => ({ label: 'TLS', state: 'pass' }) });
  assert.equal(result.checks.find((r) => r.label === '/about/').state, 'warning');
});

test('health checks discover links after safe redirects and stop redirect loops', async () => {
  const fetched = [];
  const fetcher = async (url) => {
    fetched.push(url);
    if (url.endsWith('/about/')) return new Response(null, { status: 301, headers: { location: '/about' } });
    if (url.endsWith('/about')) return new Response('<a href="/linked-file.pdf">File</a>', { headers: { 'content-type': 'text/html' } });
    if (url.endsWith('/projects/')) return new Response(null, { status: 302, headers: { location: '/projects' } });
    if (url.endsWith('/projects')) return new Response(null, { status: 302, headers: { location: '/projects/' } });
    return new Response('');
  };
  const result = await inspectSite({ fetcher, checkCv: async () => {}, checkCertificate: async () => ({ label: 'TLS', state: 'pass' }) });
  assert.equal(result.checks.find((r) => r.label === '/about/').state, 'pass');
  assert.match(result.checks.find((r) => r.label === '/about/').detail, /301 → HTTP 200/);
  assert.equal(result.checks.find((r) => r.label === '/projects/').state, 'warning');
  assert.ok(fetched.includes('https://aniqsaidi.my/linked-file.pdf'));
  assert.equal(fetched.filter((url) => url.endsWith('/projects/')).length, 1);
});

async function callEndpoint({ method = 'GET', origin = 'https://aniqsaidi.my', token = '', query = { action: 'analytics' } } = {}) {
  const headers = { origin, authorization: token ? `Bearer ${token}` : '' };
  const request = { method, headers, query, get: (key) => headers[key.toLowerCase()] };
  const response = { statusCode: 200, headers: {}, on() { return this; }, set(key, value) { this.headers[key] = value; return this; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await adminInsights(request, response);
  return response;
}
test('report endpoint rejects unauthenticated and non-admin callers before reading reports', async () => {
  assert.equal((await callEndpoint()).statusCode, 403);
  assert.equal((await callEndpoint({ method: 'POST' })).statusCode, 405);
  assert.equal((await callEndpoint({ origin: 'https://evil.test' })).statusCode, 403);
  const auth = mock.method(getAuth(), 'verifyIdToken', async () => ({ uid: 'not-admin', email_verified: true }));
  try {
    assert.equal((await callEndpoint({ token: 'test' })).statusCode, 403);
    assert.deepEqual(auth.mock.calls[0].arguments, ['test', true]);
  } finally { auth.mock.restore(); }
});

test('approved users get a setup state instead of fabricated analytics', async () => {
  const previous = process.env.GA4_PROPERTY_ID; delete process.env.GA4_PROPERTY_ID;
  const auth = mock.method(getAuth(), 'verifyIdToken', async () => ({ uid: '1Mhzu5HmjdU82yzGlph6gQHX1843', email_verified: true }));
  try {
    const result = await callEndpoint({ token: 'test' });
    assert.equal(result.statusCode, 200); assert.equal(result.body.data.state, 'setup');
    assert.equal(result.body.data.sessions, undefined);
    assert.match(result.headers['Cache-Control'], /no-store/);
    assert.equal((await callEndpoint({ token: 'test', query: { action: 'analytics', days: '99999' } })).statusCode, 400);
  } finally { auth.mock.restore(); if (previous !== undefined) process.env.GA4_PROPERTY_ID = previous; }
});

test('public instrumentation excludes private routes and carries no recruiter data', async () => {
  const tracking = await readFile(new URL('../src/components/GoogleAnalytics.astro', import.meta.url), 'utf8');
  assert.match(tracking, /aniq\.analytics\.exclude/);
  assert.match(tracking, /cms-preview/);
  assert.match(tracking, /page_location: cleanLocation/);
  assert.doesNotMatch(tracking, /email\.value|token\.value|company\.value/);
  const layout = await readFile(new URL('../src/layouts/AdminLayout.astro', import.meta.url), 'utf8');
  assert.match(layout, /localStorage\.setItem\('aniq.analytics.exclude', 'true'\)/);
});
