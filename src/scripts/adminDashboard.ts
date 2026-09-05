import {
  collection, doc, getDoc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp,
} from 'firebase/firestore';
import {
  CMS_PAGE_IDS, sanitizeCmsPage, validateCmsPage, type CmsPageId, type CmsPages,
} from '../data/cmsSchema';
import {
  analyzeCompleteness, defaultResumeDocument, defaultSeoDocument, sanitizeResumeDocument,
  sanitizeSeoDocument, type MediaRecord, type ResumeDocument, type SeoDocument,
} from '../data/cmsEditorial';
import {
  createExportBundle, exportFileName, validateImportBundle, type AuditEntry,
  type CmsExportBundle,
} from '../data/cmsOperations';
import { createRevisionId, pageChangeSummary, pageContent, pagesMatch } from '../data/cmsWorkflow';
import { initializeAdminGate } from './adminAuth';
import { initializeRecruiterInbox } from './recruiterInbox';
import { initializeAdminInsights } from './adminInsights';
import { auditPayload, downloadJson, recordAudit } from './adminOperations';

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!);
const formatDate = (value: unknown) => {
  const date = value && typeof value === 'object' && 'toDate' in value ? (value as { toDate: () => Date }).toDate() : null;
  return date ? new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kuala_Lumpur' }).format(date) : 'Not yet';
};

export async function initializeOperationsDashboard() {
  const root = document.querySelector<HTMLElement>('#operations-admin');
  const authPanel = document.querySelector<HTMLElement>('#operations-auth');
  const signInButton = document.querySelector<HTMLButtonElement>('#operations-sign-in');
  const signOutButton = document.querySelector<HTMLButtonElement>('#operations-sign-out');
  const message = document.querySelector<HTMLElement>('#operations-message');
  const status = document.querySelector<HTMLElement>('#ops-status');
  const healthSummary = document.querySelector<HTMLElement>('#ops-health-summary');
  const healthList = document.querySelector<HTMLElement>('#ops-health-list');
  const auditList = document.querySelector<HTMLElement>('#ops-audit-list');
  const importFile = document.querySelector<HTMLInputElement>('#ops-import-file');
  const importPreview = document.querySelector<HTMLElement>('#ops-import-preview');
  const importCommit = document.querySelector<HTMLButtonElement>('#ops-import-commit');
  const pageExport = document.querySelector<HTMLSelectElement>('#ops-page-export');
  if (!root || !authPanel || !signInButton || !signOutButton || !message || !status || !healthSummary || !healthList || !auditList || !importFile || !importPreview || !importCommit || !pageExport) throw new Error('Operations dashboard markup is incomplete.');
  CMS_PAGE_IDS.forEach((pageId) => pageExport.add(new Option(pageId.toUpperCase(), pageId)));

  const defaults = JSON.parse(root.dataset.pageDefaults ?? '{}') as CmsPages;
  let services: Awaited<ReturnType<typeof import('../lib/firebase').getFirebaseServices>> = null;
  let drafts = structuredClone(defaults);
  let published = structuredClone(defaults);
  let seoDraft: SeoDocument = structuredClone(defaultSeoDocument);
  let seoPublished: SeoDocument = structuredClone(defaultSeoDocument);
  let resumeDraft: ResumeDocument = structuredClone(defaultResumeDocument);
  let resumePublished: ResumeDocument = structuredClone(defaultResumeDocument);
  let media: MediaRecord[] = [];
  let audits: AuditEntry[] = [];
  let disposeOperations: (() => void) | undefined;
  let authGeneration = 0;
  let selectedImport: CmsExportBundle | null = null;
  let importBaseVersions: Record<string, number> = {};
  const versions: Record<string, number> = {};
  const timestamps: Record<string, unknown> = {};
  const setMessage = (text: string, error = false) => { message.textContent = text; message.classList.toggle('is-error', error); };

  const load = async () => {
    if (!services) return;
    const generation = authGeneration;
    Object.keys(versions).forEach((key) => delete versions[key]);
    Object.keys(timestamps).forEach((key) => delete timestamps[key]);
    drafts = structuredClone(defaults); published = structuredClone(defaults);
    seoDraft = structuredClone(defaultSeoDocument); seoPublished = structuredClone(defaultSeoDocument);
    resumeDraft = structuredClone(defaultResumeDocument); resumePublished = structuredClone(defaultResumeDocument);
    const [draftDocs, publishedDocs, seoDraftDoc, seoPublishedDoc, resumeDraftDoc, resumePublishedDoc, mediaDocs, auditDocs] = await Promise.all([
      Promise.all(CMS_PAGE_IDS.map((pageId) => getDoc(doc(services!.db, 'cmsDrafts', pageId)))),
      Promise.all(CMS_PAGE_IDS.map((pageId) => getDoc(doc(services!.db, 'cmsPublished', pageId)))),
      getDoc(doc(services.db, 'cmsSeo', 'draft')), getDoc(doc(services.db, 'cmsSeo', 'published')),
      getDoc(doc(services.db, 'cmsResume', 'draft')), getDoc(doc(services.db, 'cmsResume', 'published')),
      getDocs(collection(services.db, 'cmsMedia')),
      getDocs(query(collection(services.db, 'cmsAudit'), orderBy('timestamp', 'desc'), limit(30))),
    ]);
    if (generation !== authGeneration || !services) return;
    draftDocs.forEach((snapshot, index) => { const pageId = CMS_PAGE_IDS[index]; if (snapshot.exists()) { drafts[pageId] = sanitizeCmsPage(snapshot.data(), defaults[pageId]) as never; versions[`draft.${pageId}`] = Number(snapshot.data().version ?? 0); timestamps[`draft.${pageId}`] = snapshot.data().updatedAt; } });
    publishedDocs.forEach((snapshot, index) => { const pageId = CMS_PAGE_IDS[index]; if (snapshot.exists()) { published[pageId] = sanitizeCmsPage(snapshot.data(), defaults[pageId]) as never; versions[`published.${pageId}`] = Number(snapshot.data().version ?? 0); timestamps[`published.${pageId}`] = snapshot.data().publishedAt; } });
    if (seoDraftDoc.exists()) { seoDraft = sanitizeSeoDocument(seoDraftDoc.data()); versions['seo.draft'] = Number(seoDraftDoc.data().version ?? 0); }
    if (seoPublishedDoc.exists()) { seoPublished = sanitizeSeoDocument(seoPublishedDoc.data()); versions['seo.published'] = Number(seoPublishedDoc.data().version ?? 0); }
    if (resumeDraftDoc.exists()) { resumeDraft = sanitizeResumeDocument(resumeDraftDoc.data()); versions['resume.draft'] = Number(resumeDraftDoc.data().version ?? 0); }
    if (resumePublishedDoc.exists()) { resumePublished = sanitizeResumeDocument(resumePublishedDoc.data()); versions['resume.published'] = Number(resumePublishedDoc.data().version ?? 0); }
    media = mediaDocs.docs.map((item) => item.data() as MediaRecord);
    audits = auditDocs.docs.map((item) => item.data() as AuditEntry);
    render(); setMessage('Operations data refreshed.');
  };

  const render = () => {
    const modified = CMS_PAGE_IDS.filter((pageId) => !pagesMatch(drafts[pageId], published[pageId]));
    const lastDraft = Object.entries(timestamps).filter(([key]) => key.startsWith('draft.')).sort((a, b) => Number((b[1] as { seconds?: number })?.seconds ?? 0) - Number((a[1] as { seconds?: number })?.seconds ?? 0))[0]?.[1];
    const lastPublished = Object.entries(timestamps).filter(([key]) => key.startsWith('published.')).sort((a, b) => Number((b[1] as { seconds?: number })?.seconds ?? 0) - Number((a[1] as { seconds?: number })?.seconds ?? 0))[0]?.[1];
    const actor = services?.auth.currentUser?.email ?? 'Not signed in';
    const environment = services?.app.options.projectId ?? 'LOCAL';
    status!.innerHTML = `<article><span>CMS connection</span><strong>Connected</strong></article><article><span>Environment</span><strong>${escapeHtml(environment)}</strong></article><article><span>Editor</span><strong>${escapeHtml(actor)}</strong></article><article><span>Content changes</span><strong>${modified.length} modified page${modified.length === 1 ? '' : 's'}</strong></article><article><span>Last draft</span><strong>${escapeHtml(formatDate(lastDraft))}</strong></article><article><span>Last published</span><strong>${escapeHtml(formatDate(lastPublished))}</strong></article><article><span>Media</span><strong>${media.length} assets</strong></article><article><span>Résumé</span><strong>${resumePublished.mediaId ? 'Published' : 'Not published'}</strong></article>`;
    const contentIssues = CMS_PAGE_IDS.flatMap((pageId) => validateCmsPage(drafts[pageId]).map((issue) => ({ ...issue, pageId, severity: 'error' as const })));
    const issues = [...contentIssues, ...analyzeCompleteness(drafts, seoDraft, media, resumePublished)];
    const errors = issues.filter((issue) => issue.severity === 'error').length;
    healthSummary!.innerHTML = `<strong>${issues.length ? 'Needs attention' : 'Ready to publish'}</strong><span>${errors} errors</span><span>${issues.length - errors} warnings</span><span>${modified.length} unpublished</span>`;
    healthList!.innerHTML = issues.length ? issues.slice(0, 50).map((issue) => `<a class="quality-item" data-severity="${issue.severity}" href="${issue.pageId === 'media' || issue.pageId === 'resume' ? '/admin/media/' : `/admin/?page=${issue.pageId}`}"><span>${String(issue.pageId)} · ${issue.severity}</span><p>${escapeHtml(issue.message)}</p><small>${escapeHtml(issue.path)} ↗</small></a>`).join('') : '<p>All content checks passed.</p>';
    auditList!.innerHTML = audits.length ? audits.map((entry) => `<article><span>${escapeHtml(entry.action.replaceAll('.', ' '))}</span><div><strong>${escapeHtml(entry.summary)}</strong><small>${escapeHtml(entry.actorEmail)} · ${escapeHtml(formatDate(entry.timestamp))}</small></div><small>${escapeHtml(entry.entityType)}:${escapeHtml(entry.entityId)}</small></article>`).join('') : '<p>No activity recorded yet.</p>';
  };

  const bundleFor = (scope: CmsExportBundle['scope'], pageId: CmsPageId | '' = '') => createExportBundle({
    scope, pageId, exportedBy: services?.auth.currentUser?.email ?? '',
    drafts: scope === 'media' || scope === 'published' ? {} : pageId ? { [pageId]: drafts[pageId] } : drafts,
    published: scope === 'media' ? {} : pageId ? { [pageId]: published[pageId] } : published,
    seoDraft, seoPublished, resumeDraft, resumePublished, mediaManifest: media,
    versions: { ...versions },
  });

  document.querySelectorAll<HTMLButtonElement>('[data-export-scope]').forEach((button) => button.addEventListener('click', async () => {
    if (!services) return;
    const scope = button.dataset.exportScope as CmsExportBundle['scope'];
    const pageId = scope === 'page' ? pageExport!.value as CmsPageId : '';
    const bundle = bundleFor(scope, pageId); downloadJson(bundle, exportFileName(scope, pageId));
    setMessage(`${scope.toUpperCase()} EXPORT DOWNLOADED.`);
    try { await recordAudit(services, 'content.export', scope, pageId, `Exported ${scope}${pageId ? ` for ${pageId}` : ''}`); } catch (error) { console.error(error); }
  }));

  importFile.addEventListener('change', async () => {
    selectedImport = null; importCommit!.disabled = true;
    const file = importFile.files?.[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setMessage('Import rejected: JSON file exceeds 5 MB.', true);
    try {
      const validation = validateImportBundle(JSON.parse(await file.text()));
      if (!validation.valid || !validation.bundle) {
        importPreview!.innerHTML = validation.issues.slice(0, 20).map((issue) => `<p>${escapeHtml(issue.path)} · ${escapeHtml(issue.message)}</p>`).join('');
        return setMessage(`IMPORT VALIDATION FAILED WITH ${validation.issues.length} ISSUE${validation.issues.length === 1 ? '' : 'S'}.`, true);
      }
      selectedImport = validation.bundle; importBaseVersions = { ...versions };
      const importedIds = Object.keys(selectedImport.drafts) as CmsPageId[];
      importPreview!.innerHTML = `<strong>VALID IMPORT · ${importedIds.length} PAGE${importedIds.length === 1 ? '' : 'S'}</strong>${importedIds.map((pageId) => `<p>${pageId.toUpperCase()} · ${escapeHtml(pageChangeSummary(selectedImport!.drafts[pageId]!, drafts[pageId]))}</p>`).join('')}<small>${selectedImport.mediaManifest.length} Media RECORDS ARE MANIFEST-ONLY; BINARY FILES ARE NOT RE-UPLOADED.</small>`;
      importCommit!.disabled = false; setMessage('Import validated. review the change summary before committing.');
    } catch (error) { console.error(error); setMessage('Import rejected: file is not valid JSON.', true); }
  });

  importCommit.addEventListener('click', async () => {
    if (!services?.auth.currentUser || !selectedImport) return;
    const confirmation = window.prompt('Type IMPORT DRAFTS to create a backup and import this file. Live content will not change.');
    if (confirmation !== 'IMPORT DRAFTS') return setMessage('Import cancelled. confirmation did not match.', true);
    importCommit.disabled = true; setMessage('Verifying remote versions and creating pre-import backup…');
    try {
      const imported = selectedImport;
      await runTransaction(services.db, async (transaction) => {
        const importedIds = Object.keys(imported.drafts) as CmsPageId[];
        const draftRefs = importedIds.map((pageId) => doc(services!.db, 'cmsDrafts', pageId));
        const currentDrafts = await Promise.all(draftRefs.map((item) => transaction.get(item)));
        const seoRef = doc(services!.db, 'cmsSeo', 'draft'); const resumeRef = doc(services!.db, 'cmsResume', 'draft');
        const [currentSeo, currentResume] = await Promise.all([transaction.get(seoRef), transaction.get(resumeRef)]);
        currentDrafts.forEach((snapshot, index) => {
          const pageId = importedIds[index]; const remoteVersion = Number(snapshot.data()?.version ?? 0);
          if (remoteVersion !== Number(importBaseVersions[`draft.${pageId}`] ?? 0)) throw new Error(`CONFLICT:${pageId}`);
        });
        if (Number(currentSeo.data()?.version ?? 0) !== Number(importBaseVersions['seo.draft'] ?? 0)) throw new Error('CONFLICT:seo');
        if (Number(currentResume.data()?.version ?? 0) !== Number(importBaseVersions['resume.draft'] ?? 0)) throw new Error('CONFLICT:resume');
        const backupId = `pre-import-${Date.now()}-${crypto.randomUUID()}`;
        transaction.set(doc(services!.db, 'cmsBackups', backupId), {
          id: backupId, schemaVersion: 1, createdAt: serverTimestamp(), actorUid: services!.auth.currentUser!.uid,
          actorEmail: services!.auth.currentUser!.email ?? '', reason: `Pre-import backup for ${importedIds.join(', ')}`,
          pages: Object.fromEntries(currentDrafts.map((snapshot, index) => [importedIds[index], snapshot.exists() ? snapshot.data() : drafts[importedIds[index]]])),
          seo: currentSeo.exists() ? currentSeo.data() : seoDraft, resume: currentResume.exists() ? currentResume.data() : resumeDraft,
          mediaManifest: media.map(({ id, kind, fileName, publicUrl, storagePath, mimeType, fileSize }) => ({ id, kind, fileName, publicUrl, storagePath, mimeType, fileSize })),
          sourceVersions: { ...importBaseVersions },
        });
        importedIds.forEach((pageId, index) => {
          const page = pageContent(imported.drafts[pageId]!); const version = Number(currentDrafts[index].data()?.version ?? 0) + 1;
          const revisionId = createRevisionId(pageId, 'draft');
          transaction.set(draftRefs[index], { ...page, version, draftRevisionId: revisionId, updatedAt: serverTimestamp(), updatedBy: services!.auth.currentUser!.uid });
          transaction.set(doc(services!.db, 'cmsRevisions', pageId, 'items', revisionId), {
            revisionId, pageId, state: 'draft', content: page, summary: 'Imported from validated JSON', note: `Pre-import backup: ${backupId}`,
            editorUid: services!.auth.currentUser!.uid, editorEmail: services!.auth.currentUser!.email ?? '', createdAt: serverTimestamp(),
            previousPublishedRevisionId: String((published[pageId] as unknown as { publishedRevisionId?: string }).publishedRevisionId ?? ''),
          });
        });
        const nextSeoVersion = Number(currentSeo.data()?.version ?? 0) + 1;
        transaction.set(seoRef, { ...imported.seoDraft, version: nextSeoVersion, updatedAt: serverTimestamp(), updatedBy: services!.auth.currentUser!.uid });
        const nextResumeVersion = Number(currentResume.data()?.version ?? 0) + 1;
        transaction.set(resumeRef, { ...imported.resumeDraft, version: nextResumeVersion, updatedAt: serverTimestamp(), updatedBy: services!.auth.currentUser!.uid });
        const audit = auditPayload(services!, 'content.import', 'site', importedIds.join(','), `Imported ${importedIds.length} page draft(s); live content unchanged`);
        transaction.set(doc(services!.db, 'cmsAudit', audit.id), audit);
      });
      selectedImport = null; importFile.value = ''; importPreview!.innerHTML = '<strong>IMPORT COMPLETE · DRAFTS ONLY</strong><p>A pre-import backup and revision records were created.</p>';
      setMessage('Import complete. review and publish drafts when ready.'); await load();
    } catch (error) {
      console.error(error); const conflict = error instanceof Error && error.message.startsWith('CONFLICT:');
      setMessage(conflict ? `IMPORT BLOCKED: ${error.message.slice(9).toUpperCase()} CHANGED IN ANOTHER TAB. REFRESH AND REVIEW.` : 'IMPORT FAILED. NO LIVE CONTENT WAS CHANGED.', true);
    } finally { importCommit.disabled = !selectedImport; }
  });
  document.querySelector('#ops-refresh')?.addEventListener('click', () => void load().catch(() => setMessage('Content data could not refresh. retry shortly.', true)));

  await initializeAdminGate({ root, authPanel, signInButton, signOutButton, message, onUnauthorized: () => {
    authGeneration++;
    disposeOperations?.(); disposeOperations = undefined; services = null;
    [status, healthSummary, healthList, auditList].forEach((element) => element.replaceChildren());
  }, onAuthorized: async (_user, cloud) => {
    if (!cloud) {
      for (const id of ['recruiter-summary', 'analytics-message', 'site-health-message']) {
        const node = document.getElementById(id); if (node) node.textContent = 'Local preview: connect Firebase and sign in to load private operations data. Live reports also require the deployed reporting API.';
      }
      for (const id of ['recruiter-refresh', 'analytics-refresh', 'site-health-run']) {
        const button = document.getElementById(id) as HTMLButtonElement | null; if (button) button.disabled = true;
      }
      return setMessage('Local preview · Firebase is required for operations data.');
    }
    services = await import('../lib/firebase').then(({ getFirebaseServices }) => getFirebaseServices());
    if (!services) return;
    disposeOperations?.();
    const disposeInbox = initializeRecruiterInbox(services);
    const disposeInsights = initializeAdminInsights(services);
    disposeOperations = () => { disposeInbox(); disposeInsights(); };
    try { await recordAudit(services, 'admin.session', 'admin', 'dashboard', 'Authenticated operations dashboard session'); } catch (error) { console.error(error); }
    await load().catch(() => setMessage('Content data could not load. the inbox and reports load separately.', true));
  } });
}
