import type {
  ArchiveRecord,
  AwardRecord,
  CertificationRecord,
  CmsPage,
  CmsPageId,
  CmsPages,
  CmsRecord,
  EducationRecord,
  ExperienceRecord,
  LeadershipRecord,
  ToolkitRecord,
} from '../data/cmsSchema';
import { indexFirst } from '../data/recordOrder';

const published = <T extends CmsRecord>(records: T[] | undefined) =>
  indexFirst([...(records ?? [])].filter((record) => record.status === 'published'));

const node = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

const setLink = (anchor: HTMLAnchorElement, href: string) => {
  anchor.href = href;
  if (/^https?:\/\//i.test(href)) {
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }
};

function renderAbout(page: CmsPages['about']) {
  const { data } = page;
  const fields: Record<string, string> = {
    'about.name': 'Aniq Saidi',
    'about.role': data.role,
    'about.location': 'Selangor, Malaysia',
  };
  Object.entries(fields).forEach(([key, value]) => {
    const element = document.querySelector<HTMLElement>(`[data-cms-field="${key}"]`);
    if (element) element.textContent = value;
  });
  const email = document.querySelector<HTMLAnchorElement>('[data-cms-field="about.email"]');
  if (email) { email.textContent = data.email; email.href = `mailto:${data.email}`; }
  const linkedin = document.querySelector<HTMLAnchorElement>('[data-cms-field="about.linkedin"]');
  if (linkedin) setLink(linkedin, data.linkedin);

  const container = document.querySelector<HTMLElement>('[data-cms-collection="about.education"]');
  if (!container) return;
  const thesis = container.querySelector<HTMLElement>('.education-thesis');
  const records = published<EducationRecord>(data.education).slice(0, 1);
  container.replaceChildren(...records.map((record, index) => {
    const article = node('article', `credential${index === 0 && thesis ? ' credential--with-thesis' : ''}`);
    article.dataset.recordId = record.id;
    const copy = node('div');
    copy.append(node('h2', '', record.qualification), node('p', '', record.institution));
    article.append(copy, node('p', '', index === 0 ? 'GRADUATED // 2020' : record.period));
    if (index === 0 && thesis) article.append(thesis);
    return article;
  }));
}

function renderExperience(page: CmsPages['experience']) {
  const jobs = document.querySelector<HTMLElement>('[data-cms-collection="experience.jobs"]');
  if (jobs) jobs.replaceChildren(...published<ExperienceRecord>(page.data.jobs).map((job) => {
    const article = node('article', 'timeline-item');
    article.dataset.recordId = job.id;
    article.dataset.sortItem = ''; article.dataset.sortDate = job.startDate || job.period; article.dataset.sortTitle = job.role;
    const header = node('header', 'timeline-head');
    const heading = node('div');
    heading.append(node('h2', '', job.role), node('p', '', job.company));
    const time = node('time', '', job.period);
    time.dateTime = job.startDate;
    header.append(heading, time);
    const location = node('p', 'timeline-location', job.location);
    const list = node('ul');
    list.append(...published(job.highlights).map((item) => node('li', '', item.text)));
    const stack = node('p', 'skill-line');
    stack.append(node('span', '', 'STACK:'), ' ', node('span', '', published(job.technologies).map((item) => item.label).join(' // ')));
    article.append(header, location, list, stack);
    return article;
  }));

  const toolkit = document.querySelector<HTMLElement>('[data-cms-collection="experience.toolkit"]');
  if (toolkit) toolkit.replaceChildren(...published<ToolkitRecord>(page.data.toolkit).flatMap((record) => [
    node('dt', '', record.group),
    node('dd', '', published(record.technologies).map((item) => item.label).join(', ')),
  ]));
}

type HighlightItem = { id: string; title: string; description: string; meta?: string; signal: string };

function renderHighlights(pageId: 'certifications' | 'awards' | 'leadership', items: HighlightItem[]) {
  const section = document.querySelector<HTMLElement>(`[data-cms-highlights="${pageId}"]`);
  if (!section) return;
  const grid = section.querySelector<HTMLElement>('.record-highlights__grid');
  if (grid) grid.replaceChildren(...items.slice(0, 3).map((item) => {
    const article = node('article', 'record-highlight');
    article.dataset.recordId = item.id;
    article.append(node('span', 'record-highlight__signal', item.signal), node('h3', '', item.title), node('p', '', item.description));
    if (item.meta) article.append(node('span', 'record-highlight__meta', item.meta));
    return article;
  }));
  const count = section.querySelector<HTMLElement>('[data-highlight-count]');
  if (count) count.textContent = String(Math.min(items.length, 3)).padStart(2, '0');
}

function updateLedgerCount(container: Element, count: number) {
  const ledger = container.previousElementSibling;
  const label = ledger?.querySelector<HTMLElement>('span:first-child');
  if (label?.textContent?.includes('FULL RECORD')) label.textContent = `FULL RECORD // ${String(count).padStart(2, '0')}`;
}

function renderCertifications(page: CmsPages['certifications']) {
  const records = published<CertificationRecord>(page.data.certifications);
  renderHighlights('certifications', records.filter((item) => item.featured).map((item) => ({
    id: item.id, title: item.title, description: item.issuer, meta: item.issuedAt,
    signal: `${item.category.toUpperCase()} // VERIFIED`,
  })));
  const container = document.querySelector<HTMLElement>('[data-cms-collection="certifications.certifications"]');
  if (!container) return;
  container.replaceChildren(...records.map((record) => {
    const article = node('article', 'credential certification');
    article.dataset.recordId = record.id;
    article.dataset.sortItem = ''; article.dataset.sortDate = record.issuedAt; article.dataset.sortTitle = record.title;
    const copy = node('div');
    const title = node('h2', '', record.title);
    if (record.credentialUrl) { const link = node('a', '', record.title); setLink(link, record.credentialUrl); title.replaceChildren(link); }
    copy.append(title, node('p', '', record.issuer));
    const time = node('time', '', record.issuedAt); time.dateTime = record.issuedAt;
    article.append(copy, time);
    return article;
  }));
  updateLedgerCount(container, records.length);
}

function renderAwards(page: CmsPages['awards']) {
  const records = published<AwardRecord>(page.data.awards);
  renderHighlights('awards', records.filter((item) => item.featured).map((item) => ({
    id: item.id, title: item.title, description: item.description, meta: item.date,
    signal: `${item.category || 'RECOGNITION'} // HIGHLIGHT`.toUpperCase(),
  })));
  const container = document.querySelector<HTMLElement>('[data-cms-collection="awards.awards"]');
  if (!container) return;
  container.replaceChildren(...records.map((record) => {
    const article = node('article', 'credential credential--stacked'); article.dataset.recordId = record.id;
    article.dataset.sortItem = ''; article.dataset.sortDate = [record.date, record.title, record.description].filter(Boolean).join(' '); article.dataset.sortTitle = record.title;
    const copy = node('div'); copy.append(node('h2', '', record.title), node('p', '', [record.description, record.issuer, record.date].filter(Boolean).join(' // ')));
    article.append(copy); return article;
  }));
  updateLedgerCount(container, records.length);
}

function renderLeadership(page: CmsPages['leadership']) {
  const records = published<LeadershipRecord>(page.data.leadership);
  renderHighlights('leadership', records.filter((item) => item.featured).map((item) => ({
    id: item.id, title: item.role, description: item.description, meta: item.period,
    signal: `${item.scope || 'LEADERSHIP'} // SERVICE`.toUpperCase(),
  })));
  const container = document.querySelector<HTMLElement>('[data-cms-collection="leadership.leadership"]');
  if (!container) return;
  container.replaceChildren(...records.map((record) => {
    const article = node('article', 'credential credential--stacked'); article.dataset.recordId = record.id;
    article.dataset.sortItem = ''; article.dataset.sortDate = [record.period, record.role, record.description].filter(Boolean).join(' '); article.dataset.sortTitle = record.role;
    const copy = node('div'); copy.append(node('h2', '', record.role), node('p', '', [record.description, record.organisation, record.period].filter(Boolean).join(' // ')));
    article.append(copy); return article;
  }));
  updateLedgerCount(container, records.length);
}

function archiveArticle(record: ArchiveRecord, existing?: HTMLElement) {
  const article = existing ?? node('article', 'archive-entry-record');
  article.dataset.recordId = record.id;
  article.dataset.archiveSlug = record.slug;
  article.dataset.sortItem = ''; article.dataset.sortDate = record.publicationDate; article.dataset.sortTitle = record.title;
  const panelId = `archive-entry-${record.slug}`;
  let button = article.querySelector<HTMLButtonElement>('[data-archive-entry]');
  if (!button) {
    button = node('button', 'menu-item archive-entry-button'); button.type = 'button'; button.dataset.archiveEntry = ''; button.dataset.sfx = 'hover';
    button.append(node('span', 'mi-marker', '▪ >'), node('span', 'mi-copy'), node('time', 'mi-date'), node('span', 'archive-toggle-symbol'));
    article.append(button);
  }
  button.setAttribute('aria-controls', panelId); button.setAttribute('aria-expanded', 'false');
  const copy = button.querySelector<HTMLElement>('.mi-copy')!;
  copy.replaceChildren(node('span', 'mi-title', record.title));
  if (record.publication) copy.append(node('span', 'mi-publication', record.publication));
  const time = button.querySelector<HTMLTimeElement>('.mi-date')!; time.dateTime = record.publicationDate; time.textContent = record.publicationDate;
  let panel = article.querySelector<HTMLElement>('.archive-entry-panel');
  if (!panel) { panel = node('div', 'archive-entry-panel'); article.append(panel); }
  panel.id = panelId; panel.hidden = true;
  let description = panel.querySelector<HTMLElement>('.press-description');
  if (!description) { description = node('p', 'press-description'); panel.prepend(description); }
  description.textContent = record.description;
  if (record.assetPath && /\.(?:avif|gif|jpe?g|png|webp)(?:[?#]|$)/i.test(record.assetPath) && !panel.querySelector('.press-reader')) {
    const figure = node('figure', 'press-reader');
    const preview = node('div', 'press-clipping-preview');
    const image = node('img', 'press-clipping'); image.src = record.assetPath; image.alt = `Press clipping: ${record.title}`; image.loading = 'lazy';
    preview.append(image);
    const caption = node('figcaption'); const full = node('a', 'press-full-button', '[ VIEW FULL IMAGE ↗ ]');
    setLink(full, record.assetPath); full.dataset.sfx = ''; caption.append(full); figure.append(preview, caption); panel.append(figure);
  }
  if (record.sourceUrl) {
    let nav = panel.querySelector<HTMLElement>('.archive-source-links');
    if (!nav) { nav = node('nav', 'archive-source-links'); nav.setAttribute('aria-label', `Sources for ${record.title}`); panel.append(nav); }
    const alreadyLinked = [...nav.querySelectorAll<HTMLAnchorElement>('a')].some((link) => link.href === new URL(record.sourceUrl, location.origin).href);
    if (!alreadyLinked) {
      const link = node('a', '', 'VIEW SOURCE ↗'); setLink(link, record.sourceUrl); link.dataset.sfx = ''; link.dataset.cmsSource = '';
      nav.append(link);
    }
  }
  return article;
}

function renderArchives(page: CmsPages['archives']) {
  const lede = document.querySelector<HTMLElement>('[data-cms-field="archives.lede"]');
  if (lede) lede.textContent = page.data.lede;
  const buttonContainer = document.querySelector<HTMLElement>('.archive-year-buttons');
  const panelsContainer = document.querySelector<HTMLElement>('[data-archive-panels]');
  if (!buttonContainer || !panelsContainer) return;
  const existing = new Map<string, HTMLElement>();
  document.querySelectorAll<HTMLElement>('.archive-entry-record').forEach((article) => {
    const slug = article.querySelector('[data-archive-entry]')?.getAttribute('aria-controls')?.replace(/^archive-entry-/, '');
    if (slug) existing.set(slug, article);
  });
  const years = new Map<string, ArchiveRecord[]>();
  published<ArchiveRecord>(page.data.articles)
    .sort((a, b) => b.publicationDate.localeCompare(a.publicationDate) || a.sortOrder - b.sortOrder)
    .forEach((record) => {
      const year = record.publicationDate.slice(0, 4) || 'UNDATED';
      years.set(year, [...(years.get(year) ?? []), record]);
    });
  buttonContainer.replaceChildren(...[...years].map(([year, records]) => {
    const button = node('button', 'archive-year-button'); button.type = 'button'; button.dataset.archiveYear = year; button.dataset.sfx = 'hover';
    button.setAttribute('aria-controls', `archive-year-${year}`); button.setAttribute('aria-expanded', 'false');
    button.dataset.sortItem = ''; button.dataset.sortDate = year; button.dataset.sortTitle = year;
    button.append(`> ${year} `, node('span', '', `[${records.length}]`)); return button;
  }));
  panelsContainer.replaceChildren(...[...years].map(([year, records]) => {
    const section = node('section', 'archive-year-panel'); section.id = `archive-year-${year}`; section.hidden = true;
    section.dataset.sortItem = ''; section.dataset.sortDate = year; section.dataset.sortTitle = year;
    const heading = node('h3', 'sr-only', `Press archive entries from ${year}`);
    const list = node('div', 'menu-list archive-entry-list'); list.dataset.sortContainer = '';
    list.append(...records.map((record) => archiveArticle(record, existing.get(record.slug))));
    section.append(heading, list); return section;
  }));
}

export function renderPublishedPage(pageId: CmsPageId, value: unknown) {
  if (!value || typeof value !== 'object') return;
  const page = value as CmsPage;
  if (page.schemaVersion !== 2 || page.pageId !== pageId || !page.data) return;
  if (pageId === 'about') renderAbout(page as CmsPages['about']);
  else if (pageId === 'experience') renderExperience(page as CmsPages['experience']);
  else if (pageId === 'certifications') renderCertifications(page as CmsPages['certifications']);
  else if (pageId === 'awards') renderAwards(page as CmsPages['awards']);
  else if (pageId === 'leadership') renderLeadership(page as CmsPages['leadership']);
  else if (pageId === 'archives') renderArchives(page as CmsPages['archives']);
}
