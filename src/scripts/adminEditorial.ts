import { collection, doc, getDoc, getDocs, runTransaction, serverTimestamp } from 'firebase/firestore';
import {
  CMS_PAGE_IDS,
  sanitizeCmsPage,
  validateCmsPage,
  type CmsPageId,
  type CmsPages,
} from '../data/cmsSchema';
import {
  analyzeCompleteness,
  sanitizeResumeDocument,
  sanitizeSeoDocument,
  validateSeoDocument,
  type MediaRecord,
  type SeoDocument,
} from '../data/cmsEditorial';
import { initializeAdminGate } from './adminAuth';
import { auditPayload, recordAudit } from './adminOperations';

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!);
const labels: Record<CmsPageId, string> = { home: 'Home', about: 'About', projects: 'Projects', experience: 'Experience', certifications: 'Certifications', awards: 'Awards', leadership: 'Leadership', archives: 'Archives' };

function searchableStrings(value: unknown, path = ''): Array<{ path: string; value: string }> {
  if (typeof value === 'string') return value.trim() ? [{ path, value }] : [];
  if (Array.isArray(value)) return value.flatMap((item, index) => searchableStrings(item, `${path}.${index}`));
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => searchableStrings(item, path ? `${path}.${key}` : key));
}

export async function initializeEditorialAdmin() {
  const root = document.querySelector<HTMLElement>('#editorial-admin');
  const authPanel = document.querySelector<HTMLElement>('#editorial-auth');
  const signInButton = document.querySelector<HTMLButtonElement>('#editorial-sign-in');
  const signOutButton = document.querySelector<HTMLButtonElement>('#editorial-sign-out');
  const message = document.querySelector<HTMLElement>('#editorial-message');
  const searchInput = document.querySelector<HTMLInputElement>('#content-search');
  const searchResults = document.querySelector<HTMLElement>('#content-results');
  const tabs = document.querySelector<HTMLElement>('#seo-tabs');
  const form = document.querySelector<HTMLFormElement>('#seo-form');
  const qualitySummary = document.querySelector<HTMLElement>('#quality-summary');
  const qualityList = document.querySelector<HTMLElement>('#quality-list');
  if (!root || !authPanel || !signInButton || !signOutButton || !message || !searchInput || !searchResults || !tabs || !form || !qualitySummary || !qualityList) throw new Error('Editorial admin markup is incomplete.');

  const defaults = JSON.parse(root.dataset.pageDefaults ?? '{}') as CmsPages;
  let pages = structuredClone(defaults);
  let seo = sanitizeSeoDocument(JSON.parse(root.dataset.seoDefaults ?? '{}'));
  let media: MediaRecord[] = [];
  let resume = sanitizeResumeDocument(null);
  let selectedPage: CmsPageId = 'home';
  let services: Awaited<ReturnType<typeof import('../lib/firebase').getFirebaseServices>> = null;
  let seoVersion = 0;
  let seoPublishedVersion = 0;
  let saveTimer = 0;
  const setMessage = (text: string, error = false) => { message.textContent = text; message.classList.toggle('is-error', error); };

  const load = async () => {
    if (!services) return;
    const [pageSnapshots, seoDraft, seoPublished, resumePublished, mediaSnapshot] = await Promise.all([
      Promise.all(CMS_PAGE_IDS.map((pageId) => getDoc(doc(services!.db, 'cmsDrafts', pageId)))),
      getDoc(doc(services.db, 'cmsSeo', 'draft')),
      getDoc(doc(services.db, 'cmsSeo', 'published')),
      getDoc(doc(services.db, 'cmsResume', 'published')),
      getDocs(collection(services.db, 'cmsMedia')),
    ]);
    pageSnapshots.forEach((snapshot, index) => {
      const pageId = CMS_PAGE_IDS[index];
      if (snapshot.exists()) pages[pageId] = sanitizeCmsPage(snapshot.data(), defaults[pageId]) as never;
    });
    if (seoDraft.exists()) {
      seo = sanitizeSeoDocument(seoDraft.data());
      seoVersion = Number(seoDraft.data().version ?? 0);
    }
    seoPublishedVersion = Number(seoPublished.data()?.version ?? 0);
    resume = sanitizeResumeDocument(resumePublished.exists() ? resumePublished.data() : null);
    media = mediaSnapshot.docs.map((item) => item.data() as MediaRecord);
    renderTabs(); renderForm(); renderSearch(); renderQuality();
    setMessage('Editorial data loaded. draft changes do not affect the live site.');
  };

  const saveSeo = async (quiet = false) => {
    if (!services?.auth.currentUser) { setMessage('Seo save requires authentication.', true); return false; }
    const issues = validateSeoDocument(seo).filter((issue) => issue.severity === 'error');
    if (issues.length) { setMessage(`SEO SAVE BLOCKED: ${issues[0].pageId.toUpperCase()} ${issues[0].path} — ${issues[0].message}`, true); return false; }
    const nextVersion = seoVersion + 1;
    try {
      await runTransaction(services.db, async (transaction) => {
        const seoRef = doc(services!.db, 'cmsSeo', 'draft'); const remote = await transaction.get(seoRef);
        if (Number(remote.data()?.version ?? 0) !== seoVersion) throw new Error('CMS_CONFLICT:seo');
        transaction.set(seoRef, { ...seo, version: nextVersion, updatedAt: serverTimestamp(), updatedBy: services!.auth.currentUser!.uid });
        const audit = auditPayload(services!, 'seo.save', 'seo', 'draft', `Saved SEO draft version ${nextVersion}`);
        transaction.set(doc(services!.db, 'cmsAudit', audit.id), audit);
      });
      seoVersion = nextVersion;
      if (!quiet) setMessage('Seo draft saved. live metadata is unchanged.');
      renderQuality(); return true;
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error && error.message.startsWith('CMS_CONFLICT:') ? 'The SEO metadata changed in another tab or device. Reload before saving.' : 'The SEO draft could not be saved.', true);
      return false;
    }
  };

  const scheduleSave = () => {
    window.clearTimeout(saveTimer);
    setMessage('Seo editing · autosave pending…');
    saveTimer = window.setTimeout(() => void saveSeo(true).then((saved) => { if (saved) setMessage('Seo draft autosaved.'); }), 1200);
  };

  const renderTabs = () => {
    tabs!.innerHTML = CMS_PAGE_IDS.map((pageId) => `<button type="button" role="tab" data-seo-page="${pageId}" aria-selected="${pageId === selectedPage}">${labels[pageId]}</button>`).join('');
  };

  const field = (key: keyof SeoDocument['pages']['home'], label: string, max: number, textarea = false) => {
    const value = seo.pages[selectedPage][key];
    return `<label class="${textarea ? 'is-wide' : ''}">${label}${textarea ? `<textarea rows="3" maxlength="${max}" data-seo-field="${key}">${escapeHtml(value)}</textarea>` : `<input maxlength="${max}" value="${escapeHtml(value)}" data-seo-field="${key}" />`}<span class="field-count">${value.length}/${max}</span></label>`;
  };

  const renderForm = () => {
    const imageOptions = media.filter((record) => record.mimeType.startsWith('image/')).map((record) => `<option value="${escapeHtml(record.publicUrl)}" ${seo.pages[selectedPage].socialImage === record.publicUrl ? 'selected' : ''}>${escapeHtml(record.fileName)} // ${record.kind.toUpperCase()}</option>`).join('');
    form!.innerHTML = `${field('seoTitle', 'SEO title', 60)}${field('canonicalPath', 'Canonical path', 200)}${field('seoDescription', 'SEO description', 160, true)}${field('socialTitle', 'Social title', 60)}<label>Social image<select data-seo-field="socialImage"><option value="">No custom image</option>${imageOptions}</select></label>${field('socialDescription', 'Social description', 200, true)}`;
    renderPreviews();
  };

  const renderPreviews = () => {
    const item = seo.pages[selectedPage];
    const origin = window.location.origin;
    document.querySelector<HTMLElement>('#search-preview-title')!.textContent = item.seoTitle || labels[selectedPage];
    document.querySelector<HTMLElement>('#search-preview-url')!.textContent = `${origin}${item.canonicalPath}`;
    document.querySelector<HTMLElement>('#search-preview-description')!.textContent = item.seoDescription;
    document.querySelector<HTMLElement>('#social-preview-title')!.textContent = item.socialTitle || item.seoTitle;
    document.querySelector<HTMLElement>('#social-preview-description')!.textContent = item.socialDescription || item.seoDescription;
    const image = document.querySelector<HTMLElement>('#social-preview-image')!;
    image.style.backgroundImage = item.socialImage ? `url("${item.socialImage.replace(/["\\]/g, '\\$&')}")` : '';
    image.textContent = item.socialImage ? '' : 'No social image selected';
  };

  const renderSearch = () => {
    const term = searchInput!.value.trim().toLowerCase();
    if (term.length < 2) { searchResults!.innerHTML = '<p>Enter at least 2 characters to search your drafts.</p>'; return; }
    const matches = CMS_PAGE_IDS.flatMap((pageId) => searchableStrings(pages[pageId].data).filter((item) => item.value.toLowerCase().includes(term)).map((item) => ({ pageId, ...item }))).slice(0, 80);
    searchResults!.innerHTML = matches.length ? matches.map((match) => `<a class="content-result" href="/admin/?page=${match.pageId}"><span>${labels[match.pageId]}</span><p>${escapeHtml(match.value)}</p><small>${escapeHtml(match.path)} ↗</small></a>`).join('') : '<p>No matching content found.</p>';
  };

  const renderQuality = () => {
    const contentIssues = CMS_PAGE_IDS.flatMap((pageId) => validateCmsPage(pages[pageId]).map((issue) => ({ pageId, ...issue, severity: 'error' as const })));
    const issues = [...contentIssues, ...analyzeCompleteness(pages, seo, media, resume)];
    const errors = issues.filter((issue) => issue.severity === 'error').length;
    const warnings = issues.length - errors;
    const score = Math.max(0, Math.round(100 - errors * 5 - warnings * 2));
    qualitySummary!.innerHTML = `<strong>Readiness: ${score}%</strong><span>${errors} errors</span><span>${warnings} warnings</span><span>${issues.length ? 'Needs attention' : 'Ready to publish'}</span>`;
    qualityList!.innerHTML = issues.length ? issues.map((issue) => `<div class="quality-item" data-severity="${issue.severity}"><span>${String(issue.pageId)} · ${issue.severity}</span><p>${escapeHtml(issue.message)}</p><small>${escapeHtml(issue.path)}</small></div>`).join('') : '<p>All content, media, SEO, alt text, and résumé checks passed.</p>';
  };

  tabs.addEventListener('click', (event) => {
    const control = (event.target as Element).closest<HTMLButtonElement>('[data-seo-page]');
    if (!control) return;
    selectedPage = control.dataset.seoPage as CmsPageId;
    renderTabs(); renderForm();
  });
  form.addEventListener('input', (event) => {
    const control = (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement);
    const key = control.dataset.seoField as keyof SeoDocument['pages']['home'];
    if (!key) return;
    seo.pages[selectedPage][key] = control.value;
    const count = control.parentElement?.querySelector<HTMLElement>('.field-count');
    if (count) count.textContent = `${control.value.length}/${control.maxLength}`;
    renderPreviews(); scheduleSave();
  });
  searchInput.addEventListener('input', renderSearch);
  document.querySelector('#quality-refresh')?.addEventListener('click', renderQuality);
  document.querySelector('#seo-save')?.addEventListener('click', () => void saveSeo());
  document.querySelector('#seo-publish')?.addEventListener('click', async () => {
    if (!services?.auth.currentUser) return;
    const errors = validateSeoDocument(seo).filter((issue) => issue.severity === 'error');
    if (errors.length) return setMessage(`PUBLISH BLOCKED: ${errors[0].pageId.toUpperCase()} ${errors[0].message}`, true);
    if (!window.confirm('Publish metadata for all 8 public pages?\n\nThis changes live search and social metadata.')) return;
    if (!await saveSeo(true)) return;
    const nextVersion = seoPublishedVersion + 1;
    try {
      await runTransaction(services.db, async (transaction) => {
        const publishedRef = doc(services!.db, 'cmsSeo', 'published'); const remote = await transaction.get(publishedRef);
        if (Number(remote.data()?.version ?? 0) !== seoPublishedVersion) throw new Error('CMS_CONFLICT:seo-published');
        transaction.set(publishedRef, { ...seo, version: nextVersion, updatedAt: serverTimestamp(), publishedAt: serverTimestamp(), updatedBy: services!.auth.currentUser!.uid });
        const audit = auditPayload(services!, 'seo.publish', 'seo', 'published', `Published SEO metadata version ${nextVersion}`);
        transaction.set(doc(services!.db, 'cmsAudit', audit.id), audit);
      });
      seoPublishedVersion = nextVersion; setMessage('Seo metadata published for all 8 pages.');
    } catch (error) {
      console.error(error); setMessage(error instanceof Error && error.message.startsWith('CMS_CONFLICT:') ? 'The published SEO metadata changed elsewhere. Reload before publishing.' : 'The SEO metadata could not be published.', true);
    }
  });

  window.addEventListener('keydown', (event) => {
    const target = event.target as HTMLElement;
    if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) { event.preventDefault(); searchInput.focus(); return; }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); document.querySelector<HTMLButtonElement>('#seo-save')?.click(); }
  });

  await initializeAdminGate({ root, authPanel, signInButton, signOutButton, message, onAuthorized: async (_user, cloud) => {
    if (!cloud) return setMessage('Local mode requires Firebase configuration for editorial data.', true);
    services = await import('../lib/firebase').then(({ getFirebaseServices }) => getFirebaseServices());
    if (services) try { await recordAudit(services, 'admin.session', 'admin', 'editorial', 'Authenticated editorial editor session'); } catch (error) { console.error(error); }
    await load();
  } });
}
