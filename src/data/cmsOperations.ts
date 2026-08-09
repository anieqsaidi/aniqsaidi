import {
  CMS_PAGE_IDS,
  CMS_SCHEMA_VERSION,
  isCmsPage,
  validateCmsPage,
  validateCmsPages,
  type CmsPageId,
  type CmsPages,
  type ValidationIssue,
} from './cmsSchema.ts';
import {
  EDITORIAL_SCHEMA_VERSION,
  sanitizeResumeDocument,
  sanitizeSeoDocument,
  validateSeoDocument,
  type MediaRecord,
  type ResumeDocument,
  type SeoDocument,
} from './cmsEditorial.ts';

export const CMS_EXPORT_VERSION = 1 as const;
export const AUDIT_ACTIONS = [
  'admin.session', 'draft.save', 'page.publish', 'site.publish',
  'revision.restore', 'revision.republish', 'record.archive', 'record.restore', 'record.delete',
  'media.upload', 'media.update', 'media.delete', 'resume.select', 'resume.publish',
  'seo.save', 'seo.publish', 'content.import', 'content.export',
] as const;
export type AuditAction = typeof AUDIT_ACTIONS[number];

export interface AuditEntry {
  id: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  actorUid: string;
  actorEmail: string;
  summary: string;
  revisionId: string;
  timestamp?: unknown;
}

export interface CmsExportBundle {
  exportVersion: typeof CMS_EXPORT_VERSION;
  schemaVersion: typeof CMS_SCHEMA_VERSION;
  editorialSchemaVersion: typeof EDITORIAL_SCHEMA_VERSION;
  exportedAt: string;
  exportedBy: string;
  scope: 'complete' | 'page' | 'published' | 'media';
  pageId: CmsPageId | '';
  drafts: Partial<CmsPages>;
  published: Partial<CmsPages>;
  seoDraft: SeoDocument;
  seoPublished: SeoDocument;
  resumeDraft: ResumeDocument;
  resumePublished: ResumeDocument;
  mediaManifest: MediaRecord[];
  versions: Record<string, number>;
}

export interface ImportValidation {
  valid: boolean;
  issues: ValidationIssue[];
  bundle?: CmsExportBundle;
}

const cleanMedia = (value: unknown): MediaRecord[] => Array.isArray(value)
  ? value.filter((item): item is MediaRecord => Boolean(item && typeof item === 'object' && typeof (item as MediaRecord).id === 'string'))
  : [];

export function validateImportBundle(value: unknown): ImportValidation {
  const issues: ValidationIssue[] = [];
  if (!value || typeof value !== 'object') return { valid: false, issues: [{ path: 'file', message: 'Import must contain a JSON object.' }] };
  const candidate = value as Partial<CmsExportBundle>;
  if (candidate.exportVersion !== CMS_EXPORT_VERSION) issues.push({ path: 'exportVersion', message: `Only export version ${CMS_EXPORT_VERSION} is supported.` });
  if (candidate.schemaVersion !== CMS_SCHEMA_VERSION) issues.push({ path: 'schemaVersion', message: `Content schema ${CMS_SCHEMA_VERSION} is required.` });
  if (!candidate.drafts || typeof candidate.drafts !== 'object') issues.push({ path: 'drafts', message: 'Draft pages are required.' });
  const drafts = {} as Partial<CmsPages>;
  for (const pageId of CMS_PAGE_IDS) {
    const page = candidate.drafts?.[pageId];
    if (!page) continue;
    if (!isCmsPage(page, pageId)) issues.push({ path: `drafts.${pageId}`, message: 'Page structure or page ID is invalid.' });
    else drafts[pageId] = structuredClone(page) as never;
  }
  if (!Object.keys(drafts).length) issues.push({ path: 'drafts', message: 'Import contains no draft pages.' });
  if (Object.keys(drafts).length === CMS_PAGE_IDS.length) issues.push(...validateCmsPages(drafts as CmsPages));
  else for (const [pageId, page] of Object.entries(drafts)) {
    if (!page) continue;
    issues.push(...validateCmsPage(page).map((issue) => ({ ...issue, path: `drafts.${pageId}.${issue.path}` })));
  }
  const seoDraft = sanitizeSeoDocument(candidate.seoDraft);
  issues.push(...validateSeoDocument(seoDraft).filter((issue) => issue.severity === 'error').map(({ path, message, pageId }) => ({ path: `seoDraft.${pageId}.${path}`, message })));
  if (issues.length) return { valid: false, issues };
  const bundle: CmsExportBundle = {
    exportVersion: CMS_EXPORT_VERSION,
    schemaVersion: CMS_SCHEMA_VERSION,
    editorialSchemaVersion: EDITORIAL_SCHEMA_VERSION,
    exportedAt: typeof candidate.exportedAt === 'string' ? candidate.exportedAt : new Date().toISOString(),
    exportedBy: typeof candidate.exportedBy === 'string' ? candidate.exportedBy : '',
    scope: candidate.scope === 'page' || candidate.scope === 'published' || candidate.scope === 'media' ? candidate.scope : 'complete',
    pageId: CMS_PAGE_IDS.includes(candidate.pageId as CmsPageId) ? candidate.pageId as CmsPageId : '',
    drafts,
    published: (candidate.published && typeof candidate.published === 'object' ? candidate.published : {}) as Partial<CmsPages>,
    seoDraft,
    seoPublished: sanitizeSeoDocument(candidate.seoPublished),
    resumeDraft: sanitizeResumeDocument(candidate.resumeDraft),
    resumePublished: sanitizeResumeDocument(candidate.resumePublished),
    mediaManifest: cleanMedia(candidate.mediaManifest),
    versions: candidate.versions && typeof candidate.versions === 'object' ? candidate.versions : {},
  };
  return { valid: true, issues: [], bundle };
}

export function createExportBundle(input: Omit<CmsExportBundle, 'exportVersion' | 'schemaVersion' | 'editorialSchemaVersion' | 'exportedAt'>): CmsExportBundle {
  return {
    exportVersion: CMS_EXPORT_VERSION,
    schemaVersion: CMS_SCHEMA_VERSION,
    editorialSchemaVersion: EDITORIAL_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    ...input,
  };
}

export function exportFileName(scope: CmsExportBundle['scope'], pageId: CmsPageId | '' = '') {
  const date = new Date().toISOString().slice(0, 10);
  return `aniq-cms-${scope}${pageId ? `-${pageId}` : ''}-${date}.json`;
}
