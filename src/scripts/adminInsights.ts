import type { FirebaseServices } from '../lib/firebase';

type Row = { label: string; value: number };
type Analytics = { state: 'ready' | 'setup'; message?: string; days: number; timeZone: string; fetchedAt: string; sessions: number; users: number; views: number; cvSubmissions: number; cvSessionRate: number | null; outboundClicks: number; trend: Row[]; pages: Row[]; projects: Row[]; limited: boolean };
type Health = { checkedAt: string; origin: string; linksChecked: number; linksDiscovered: number; checks: Array<{ label: string; state: string; detail: string; latencyMs?: number }> };
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '') => { const element = document.createElement(tag); element.textContent = text; return element; };
const date = (value: string) => new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kuala_Lumpur' }).format(new Date(value));
const number = (value: number) => new Intl.NumberFormat('en-MY').format(value);

export function initializeAdminInsights(services: FirebaseServices) {
  const days = document.querySelector<HTMLSelectElement>('#analytics-days')!;
  const refresh = document.querySelector<HTMLButtonElement>('#analytics-refresh')!;
  const run = document.querySelector<HTMLButtonElement>('#site-health-run')!;
  const message = document.querySelector<HTMLElement>('#analytics-message')!;
  const healthMessage = document.querySelector<HTMLElement>('#site-health-message')!;
  const metrics = document.querySelector<HTMLElement>('#analytics-metrics')!;
  const trend = document.querySelector<HTMLElement>('#analytics-trend')!;
  const pages = document.querySelector<HTMLElement>('#analytics-pages')!;
  const projects = document.querySelector<HTMLElement>('#analytics-projects')!;
  const results = document.querySelector<HTMLElement>('#site-health-results')!;
  const controller = new AbortController();
  const api = async <T>(action: string): Promise<T> => {
    const user = services.auth.currentUser;
    if (!user) throw new Error('Sign in again to continue.');
    const token = await user.getIdToken();
    const response = await fetch(`/api/admin/insights?action=${action}&days=${days.value}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(65000)]) });
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Reporting API is not available here. Deploy the adminInsights function and Hosting route to enable it.');
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.message ?? 'Report unavailable. Try again.');
    return payload.data as T;
  };
  const table = (root: HTMLElement, title: string, rows: Row[], metric: string) => {
    root.replaceChildren(el('h3', title));
    if (!rows.length) { root.append(el('p', 'No recorded activity in this period.')); return; }
    const table = el('table'); const head = el('thead'); const tr = el('tr');
    const label = el('th', 'Page / project'); label.scope = 'col'; const count = el('th', metric); count.scope = 'col'; tr.append(label, count); head.append(tr);
    const body = el('tbody');
    for (const row of rows) { const tr = el('tr'); tr.append(el('td', row.label), el('td', number(row.value))); body.append(tr); }
    table.append(head, body); root.append(table);
  };
  const renderTrend = (rows: Row[], period: number, timeZone: string, fetchedAt: string) => {
    trend.replaceChildren(el('h3', 'DAILY Sessions'));
    // GA omits zero-event dates. Fill the complete reporting window in the property timezone.
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(fetchedAt));
    const part = (name: string) => parts.find((p) => p.type === name)!.value;
    const today = new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00Z`);
    const byDay = new Map(rows.map((row) => [row.label, row.value]));
    const daily = Array.from({ length: period }, (_, index) => {
      const key = new Date(today.valueOf() - (period - index) * 86400000).toISOString().slice(0, 10);
      return { label: key, value: byDay.get(key.replaceAll('-', '')) ?? 0 };
    });
    const max = Math.max(1, ...daily.map((row) => row.value));
    const bars = el('div'); bars.className = 'ops-trend-bars'; bars.setAttribute('role', 'img'); bars.setAttribute('aria-label', `Daily sessions over ${period} complete days. Exact values in the table below.`);
    for (const row of daily) { const bar = el('span'); bar.style.height = `${row.value / max * 100}%`; bar.title = `${row.label}: ${row.value} sessions`; bars.append(bar); }
    const axis = el('div'); axis.className = 'ops-trend-axis'; axis.append(el('span', daily[0].label), el('span', daily.at(-1)!.label));
    const details = el('details'); details.className = 'ops-daily-table'; details.append(el('summary', 'Daily values'));
    const data = el('table'); const head = el('thead'); const headings = el('tr');
    const dayHeader = el('th', 'Date'); dayHeader.scope = 'col'; const sessionsHeader = el('th', 'Sessions'); sessionsHeader.scope = 'col'; headings.append(dayHeader, sessionsHeader); head.append(headings);
    const body = el('tbody'); daily.forEach((row) => { const tr = el('tr'); tr.append(el('td', row.label), el('td', number(row.value))); body.append(tr); }); data.append(head, body); details.append(data);
    trend.append(el('p', `Peak: ${number(Math.max(0, ...daily.map((row) => row.value)))} sessions per day`), bars, axis, details);
  };
  const loadAnalytics = async () => {
    if (refresh.disabled) return;
    refresh.disabled = true; days.disabled = true; message.dataset.error = 'false'; message.textContent = 'Loading traffic report…';
    [metrics, trend, pages, projects].forEach((element) => element.replaceChildren());
    try {
      const report = await api<Analytics>('analytics'); if (controller.signal.aborted) return;
      if (report.state !== 'ready') { message.textContent = report.message ?? 'Analytics setup is required.'; return; }
      message.textContent = `${report.days} complete days · ${report.timeZone} · retrieved ${date(report.fetchedAt)} MYT · reports cached up to 5 minutes.${report.limited ? ' GA4 reports thresholding, sampling, or grouped data; interpret these figures as limited.' : ''}`;
      const cards: Array<[string, string]> = [['Sessions', number(report.sessions)], ['Users', number(report.users)], ['Page views', number(report.views)], ['CV submissions', number(report.cvSubmissions)], ['CV submission rate', report.cvSessionRate === null ? '—' : `${(report.cvSessionRate * 100).toFixed(1)}%`], ['Outbound clicks', number(report.outboundClicks)]];
      cards.forEach(([label, value]) => { const card = el('article'); card.append(el('span', label), el('strong', value)); metrics.append(card); });
      renderTrend(report.trend, report.days, report.timeZone, report.fetchedAt);
      table(pages, 'Top pages', report.pages, 'Views'); table(projects, 'Top project case files', report.projects, 'Opens');
    } catch (error) {
      if (!controller.signal.aborted) { message.textContent = error instanceof Error ? error.message : 'Traffic report unavailable.'; message.dataset.error = 'true'; }
    } finally { if (!controller.signal.aborted) { refresh.disabled = false; days.disabled = false; } }
  };
  const loadHealth = async () => {
    if (run.disabled) return;
    run.disabled = true; results.replaceChildren(); healthMessage.dataset.error = 'false'; healthMessage.textContent = 'Checking the live site… This can take up to a minute.';
    try {
      const report = await api<Health>('health'); if (controller.signal.aborted) return;
      const failed = report.checks.filter((check) => check.state === 'fail').length;
      healthMessage.textContent = `${failed} failed checks · checked ${date(report.checkedAt)} MYT · ${report.linksChecked} of ${report.linksDiscovered} discovered internal links checked (limit 40). Results cached up to 1 minute.`;
      for (const check of report.checks) {
        const row = el('article'); row.className = 'ops-health-row'; row.dataset.state = check.state;
        row.append(el('strong', check.state.charAt(0).toUpperCase() + check.state.slice(1)), el('strong', check.label), el('span', `${check.detail}${typeof check.latencyMs === 'number' ? ` · ${check.latencyMs} ms` : ''}`)); results.append(row);
      }
    } catch (error) { if (!controller.signal.aborted) { healthMessage.textContent = error instanceof Error ? error.message : 'Health checks unavailable.'; healthMessage.dataset.error = 'true'; } }
    finally { if (!controller.signal.aborted) run.disabled = false; }
  };
  refresh.addEventListener('click', loadAnalytics); days.addEventListener('change', loadAnalytics); run.addEventListener('click', loadHealth);
  void loadAnalytics();
  return () => {
    controller.abort(); refresh.removeEventListener('click', loadAnalytics); days.removeEventListener('change', loadAnalytics); run.removeEventListener('click', loadHealth);
    refresh.disabled = false; days.disabled = false; run.disabled = false;
    [metrics, trend, pages, projects, results].forEach((element) => element.replaceChildren());
    message.textContent = 'Sign in to load Google Analytics reports.'; healthMessage.textContent = 'No checks run in this session.';
  };
}
