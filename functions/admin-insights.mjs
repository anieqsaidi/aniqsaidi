import tls from 'node:tls';

export const PUBLIC_ROUTES = ['/', '/about/', '/projects/', '/experience/', '/certifications/', '/awards/', '/leadership/', '/archives/', '/resume/'];
const SITE = 'https://aniqsaidi.my';
const pathFilter = { andGroup: { expressions: [
  { notExpression: { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'PARTIAL_REGEXP', value: '^/(admin|batam|api|resume/requested|email-preview)(/|$)' } } } },
  { filter: { fieldName: 'hostName', inListFilter: { values: ['aniqsaidi.my', 'aniqsaidi.web.app'] } } },
] } };
const eventFilter = (name) => ({ andGroup: { expressions: [pathFilter, { filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: name } } }] } });

export function analyticsReports(days) {
  if (![7, 30, 90].includes(days)) throw new Error('Unsupported reporting window.');
  const base = { dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'yesterday' }], dimensionFilter: pathFilter };
  return [
    { ...base, metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'screenPageViews' }] },
    { ...base, dimensions: [{ name: 'date' }], metrics: [{ name: 'sessions' }], orderBys: [{ dimension: { dimensionName: 'date' } }] },
    { ...base, dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }], orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: '10' },
    { ...base, dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }, { name: 'sessions' }], dimensionFilter: { andGroup: { expressions: [pathFilter, { filter: { fieldName: 'eventName', inListFilter: { values: ['cv_request_submitted', 'portfolio_outbound', 'project_open'] } } }] } } },
    { ...base, dimensions: [{ name: 'pagePathPlusQueryString' }], metrics: [{ name: 'eventCount' }], dimensionFilter: eventFilter('project_open'), orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }], limit: '10' },
  ];
}

export function summarizeAnalytics(reports, days, now = new Date()) {
  if (!Array.isArray(reports) || reports.length !== 5 || reports.some((r) => !r || !Array.isArray(r.metricHeaders))) throw new Error('Incomplete analytics response.');
  const timeZone = reports[0].metadata?.timeZone;
  if (typeof timeZone !== 'string') throw new Error('Analytics property timezone is unavailable.');
  new Intl.DateTimeFormat('en', { timeZone }).format(now);
  const value = (row, index) => Number(row?.metricValues?.[index]?.value ?? 0);
  const summary = reports[0].rows?.[0];
  const sessions = value(summary, 0);
  const events = Object.fromEntries((reports[3].rows ?? []).map((row) => [row.dimensionValues[0].value, { count: value(row, 0), sessions: value(row, 1) }]));
  const cvSessions = events.cv_request_submitted?.sessions ?? 0;
  const rows = (report) => (report.rows ?? []).map((row) => ({ label: row.dimensionValues[0].value, value: value(row, 0) }));
  return {
    state: 'ready', days, fetchedAt: now.toISOString(), timeZone,
    sessions, users: value(summary, 1), views: value(summary, 2), cvSubmissions: events.cv_request_submitted?.count ?? 0,
    cvSessionRate: sessions ? cvSessions / sessions : null, outboundClicks: events.portfolio_outbound?.count ?? 0,
    trend: rows(reports[1]), pages: rows(reports[2]), projects: rows(reports[4]),
    limited: reports.some((r) => r.metadata?.subjectToThresholding || r.metadata?.dataLossFromOtherRow || r.metadata?.samplingMetadatas?.length),
  };
}

export function internalLinks(html, base = SITE) {
  const links = new Set();
  for (const match of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    try {
      const url = new URL(match[1].replaceAll('&amp;', '&'), base);
      if (url.origin === SITE && !/^\/(admin|batam|api|__)(\/|$)/.test(url.pathname)) links.add(url.pathname);
    } catch { /* A malformed href is not a safe probe target. */ }
  }
  return [...links];
}

async function probe(path, fetcher, readHtml = false, visited = new Set()) {
  const start = Date.now();
  visited.add(path);
  try {
    const response = await fetcher(`${SITE}${path}`, { method: readHtml ? 'GET' : 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'AniqSiteHealth/1.0' } });
    const redirect = response.status >= 300 && response.status < 400;
    if (redirect) {
      const location = response.headers.get('location');
      const destination = location ? new URL(location, `${SITE}${path}`) : null;
      if (destination?.origin === SITE && !/^\/(admin|batam|api|__)(\/|$)/.test(destination.pathname) && !visited.has(destination.pathname) && visited.size < 4) {
        const target = await probe(destination.pathname, fetcher, readHtml, visited);
        return { ...target, label: path, detail: `HTTP ${response.status} → ${target.detail}`, latencyMs: Date.now() - start };
      }
    }
    // External/private redirects, loops, and long chains are not proof of health.
    const state = response.ok ? 'pass' : redirect ? 'warning' : 'fail';
    const html = response.ok && readHtml && response.headers.get('content-type')?.includes('text/html') ? (await response.text()).slice(0, 1500000) : '';
    return { label: path, state, detail: `HTTP ${response.status}${redirect ? ' · redirect destination not verified' : ''}`, latencyMs: Date.now() - start, html, contentPath: path };
  } catch {
    return { label: path, state: 'fail', detail: 'Request failed or exceeded 8 seconds.', latencyMs: Date.now() - start, html: '' };
  }
}

export function certificateCheck() {
  return new Promise((resolve) => {
    const socket = tls.connect({ host: 'aniqsaidi.my', servername: 'aniqsaidi.my', port: 443, rejectUnauthorized: true });
    let complete = false;
    const finish = (result) => { if (complete) return; complete = true; socket.destroy(); resolve(result); };
    socket.setTimeout(8000, () => finish({ label: 'TLS certificate', state: 'fail', detail: 'TLS connection timed out.' }));
    socket.on('error', () => finish({ label: 'TLS certificate', state: 'fail', detail: 'Could not verify the live TLS certificate.' }));
    socket.on('secureConnect', () => {
      const expires = new Date(socket.getPeerCertificate().valid_to);
      if (!Number.isFinite(expires.valueOf())) return finish({ label: 'TLS certificate', state: 'warning', detail: 'Certificate expiry unavailable.' });
      const days = Math.floor((expires.valueOf() - Date.now()) / 86400000);
      finish({ label: 'TLS certificate', state: days < 14 ? 'warning' : 'pass', detail: `Expires ${expires.toISOString().slice(0, 10)} · ${days} days remaining.` });
    });
  });
}

export async function inspectSite({ fetcher = fetch, checkCv, checkCertificate = certificateCheck }) {
  const [routes, cv, certificate] = await Promise.all([
    Promise.all(PUBLIC_ROUTES.map((path) => probe(path, fetcher, true))),
    checkCv().then(() => ({ label: 'Published CV file', state: 'pass', detail: 'Published metadata and private PDF in Storage are valid.' })).catch(() => ({ label: 'Published CV file', state: 'fail', detail: 'Published CV configuration or private PDF is unavailable.' })),
    checkCertificate(),
  ]);
  const discovered = [...new Set(routes.flatMap((r) => internalLinks(r.html, `${SITE}${r.contentPath ?? r.label}`)))].filter((path) => !PUBLIC_ROUTES.includes(path));
  const checks = [...routes.map(({ html, contentPath, ...result }) => result), cv, certificate];
  // Bound work and concurrency; only fixed-origin links are eligible, never arbitrary URLs.
  const selected = discovered.slice(0, 40);
  for (let offset = 0; offset < selected.length; offset += 10) {
    const batch = await Promise.all(selected.slice(offset, offset + 10).map((path) => probe(path, fetcher)));
    checks.push(...batch.map(({ html, contentPath, ...result }) => result));
  }
  checks.push({ label: 'Email delivery', state: 'unverified', detail: 'No verification email was sent. File readiness does not verify inbox delivery.' });
  checks.push({ label: 'Domain renewal', state: 'unverified', detail: 'Check the renewal date with your registrar. TLS expiry is a separate check.' });
  return { checkedAt: new Date().toISOString(), origin: SITE, checks, linksChecked: selected.length, linksDiscovered: discovered.length };
}
