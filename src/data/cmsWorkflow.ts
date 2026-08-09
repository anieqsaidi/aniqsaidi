import {
  CMS_PAGE_IDS,
  type CmsPage,
  type CmsPageId,
  type CmsPages,
  type CmsRecord,
} from './cmsSchema.ts';

export type RevisionState = 'draft' | 'published';

export interface CmsRevision {
  revisionId: string;
  pageId: CmsPageId;
  state: RevisionState;
  content: CmsPage;
  summary: string;
  note: string;
  editorUid: string;
  editorEmail: string;
  createdAt?: unknown;
  previousPublishedRevisionId: string;
}

export interface StoredCmsPage extends CmsPage {
  updatedAt?: unknown;
  publishedAt?: unknown;
  updatedBy?: string;
  version?: number;
  draftRevisionId?: string;
  publishedRevisionId?: string;
}

const clone = <T>(value: T): T => structuredClone(value);

export function pageContent(page: CmsPage): CmsPage {
  return {
    schemaVersion: page.schemaVersion,
    pageId: page.pageId,
    title: page.title,
    data: clone(page.data),
  };
}

function publishValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .filter((item) => !item || typeof item !== 'object' || !('status' in item) || (item as CmsRecord).status === 'published')
      .map(publishValue);
  }
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, publishValue(item)]));
}

export function preparePublishedPage<T extends CmsPage>(page: T): T {
  const core = pageContent(page);
  core.data = publishValue(core.data) as Record<string, unknown>;
  return core as T;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !['updatedAt', 'publishedAt', 'updatedBy', 'version', 'draftRevisionId', 'publishedRevisionId'].includes(key))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, canonical(item)]),
  );
}

export function pagesMatch(left: CmsPage | undefined, right: CmsPage | undefined) {
  if (!left || !right) return false;
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

export function pageChangeSummary(draft: CmsPage, published?: CmsPage) {
  if (!published) return `${draft.title}: first structured publication`;
  if (pagesMatch(preparePublishedPage(draft), published)) return `${draft.title}: no public content changes`;

  const counts = (page: CmsPage) => Object.values(page.data).reduce((total, value) =>
    total + (Array.isArray(value) ? value.filter((item) => !item || typeof item !== 'object' || (item as CmsRecord).status !== 'archived').length : 0), 0);
  const before = counts(published);
  const after = counts(preparePublishedPage(draft));
  const delta = after - before;
  return `${draft.title}: content updated${delta ? ` (${delta > 0 ? '+' : ''}${delta} record${Math.abs(delta) === 1 ? '' : 's'})` : ''}`;
}

export function changedPageIds(drafts: CmsPages, published: Partial<CmsPages>) {
  return CMS_PAGE_IDS.filter((pageId) => !pagesMatch(drafts[pageId], published[pageId]));
}

export function createRevisionId(pageId: CmsPageId, state: RevisionState) {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${pageId}-${state}-${Date.now()}-${random}`;
}
