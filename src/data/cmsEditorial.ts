import { CMS_PAGE_IDS, type CmsPageId, type CmsPages, type ValidationIssue } from './cmsSchema.ts';

export const EDITORIAL_SCHEMA_VERSION = 1 as const;
export const MEDIA_KINDS = ['project', 'archive', 'award', 'certification', 'profile', 'social', 'architecture', 'resume', 'document'] as const;
export type MediaKind = typeof MEDIA_KINDS[number];

export interface MediaRecord {
  id: string;
  kind: MediaKind;
  fileName: string;
  storagePath: string;
  originalStoragePath: string;
  thumbnailStoragePath: string;
  publicUrl: string;
  originalUrl: string;
  thumbnailUrl: string;
  mimeType: string;
  originalMimeType: string;
  fileSize: number;
  originalFileSize: number;
  width: number;
  height: number;
  altText: string;
  caption: string;
  credit: string;
  usageReferences: string[];
  uploadedAt?: unknown;
  uploadedBy: string;
  updatedAt?: unknown;
}

export interface SeoMetadata {
  seoTitle: string;
  seoDescription: string;
  canonicalPath: string;
  socialTitle: string;
  socialDescription: string;
  socialImage: string;
}

export interface SeoDocument {
  schemaVersion: typeof EDITORIAL_SCHEMA_VERSION;
  pages: Record<CmsPageId, SeoMetadata>;
}

export interface ResumeDocument {
  schemaVersion: typeof EDITORIAL_SCHEMA_VERSION;
  mediaId: string;
  fileName: string;
  publicUrl: string;
  fileSize: number;
  versionLabel: string;
  updatedDate: string;
}

export interface CompletenessIssue extends ValidationIssue {
  pageId: CmsPageId | 'media' | 'resume';
  severity: 'error' | 'warning';
}

const descriptions: Record<CmsPageId, string> = {
  home: 'Software engineer building production systems across healthcare, cloud, data, web, mobile, and AI integration.',
  about: 'About Muhammad Amrun Aniq Bin Mohamed Saidi, a software engineer based in Selangor, Malaysia.',
  projects: 'Engineering case studies covering healthcare platforms, responsive web delivery, and enterprise analytics.',
  experience: 'Professional experience across healthcare software, cloud analytics, business systems, and mobile delivery.',
  certifications: 'Professional, cloud, analytics, and software-engineering certifications earned by Aniq Saidi.',
  awards: 'Recognition for engineering delivery, innovation, academic achievement, and professional contribution.',
  leadership: 'Leadership experience across national student representation, university programmes, and volunteer initiatives.',
  archives: 'Published press coverage preserving Aniq Saidi’s leadership, innovation, and public involvement.',
};

export const publicPaths: Record<CmsPageId, string> = {
  home: '/', about: '/about/', projects: '/projects/', experience: '/experience/',
  certifications: '/certifications/', awards: '/awards/', leadership: '/leadership/', archives: '/archives/',
};

export const defaultSeoDocument: SeoDocument = {
  schemaVersion: EDITORIAL_SCHEMA_VERSION,
  pages: Object.fromEntries(CMS_PAGE_IDS.map((pageId) => [pageId, {
    seoTitle: pageId === 'home' ? 'ANIQ SAIDI' : `${pageId.toUpperCase()} // ANIQ SAIDI`,
    seoDescription: descriptions[pageId],
    canonicalPath: publicPaths[pageId],
    socialTitle: pageId === 'home' ? 'ANIQ SAIDI // SOFTWARE ENGINEER' : `${pageId.toUpperCase()} // ANIQ SAIDI`,
    socialDescription: descriptions[pageId],
    socialImage: '/social/aniq-terminal-social.png',
  }])) as Record<CmsPageId, SeoMetadata>,
};

export const defaultResumeDocument: ResumeDocument = {
  schemaVersion: EDITORIAL_SCHEMA_VERSION,
  mediaId: '', fileName: '', publicUrl: '', fileSize: 0, versionLabel: '', updatedDate: '',
};

export function validateMediaRecord(record: MediaRecord) {
  const issues: ValidationIssue[] = [];
  const required = (value: string, path: string) => { if (!value.trim()) issues.push({ path, message: 'This field is required.' }); };
  required(record.id, 'id'); required(record.fileName, 'fileName'); required(record.storagePath, 'storagePath');
  required(record.publicUrl, 'publicUrl'); required(record.mimeType, 'mimeType'); required(record.uploadedBy, 'uploadedBy');
  if (!MEDIA_KINDS.includes(record.kind)) issues.push({ path: 'kind', message: 'Media type is invalid.' });
  if (record.fileSize <= 0 || record.fileSize > 12 * 1024 * 1024) issues.push({ path: 'fileSize', message: 'Stored file must be between 1 byte and 12 MB.' });
  if (record.mimeType.startsWith('image/') && !record.altText.trim()) issues.push({ path: 'altText', message: 'Alt text is required for images.' });
  if (record.mimeType.startsWith('image/') && (record.width < 320 || record.height < 180)) issues.push({ path: 'dimensions', message: 'Image resolution is too low for reliable display.' });
  return issues;
}

export function validateSeoDocument(document: SeoDocument) {
  const issues: CompletenessIssue[] = [];
  const titles = new Map<string, CmsPageId>();
  for (const pageId of CMS_PAGE_IDS) {
    const seo = document.pages[pageId];
    const add = (path: string, message: string, severity: 'error' | 'warning' = 'error') => issues.push({ pageId, path, message, severity });
    if (!seo?.seoTitle.trim()) add('seoTitle', 'SEO title is required.');
    else if (seo.seoTitle.length > 60) add('seoTitle', 'SEO title exceeds the recommended 60 characters.', 'warning');
    if (!seo?.seoDescription.trim()) add('seoDescription', 'SEO description is required.');
    else if (seo.seoDescription.length < 70 || seo.seoDescription.length > 160) add('seoDescription', 'SEO description should be 70–160 characters.', 'warning');
    if (!seo?.canonicalPath.startsWith('/')) add('canonicalPath', 'Canonical path must begin with /.');
    if (!seo?.socialTitle.trim()) add('socialTitle', 'Social title is required.');
    if (!seo?.socialDescription.trim()) add('socialDescription', 'Social description is required.');
    if (!seo?.socialImage.trim()) add('socialImage', 'Add a 1200×630 social image.', 'warning');
    const titleKey = seo?.seoTitle.trim().toLowerCase();
    if (titleKey && titles.has(titleKey)) add('seoTitle', `SEO title duplicates ${titles.get(titleKey)?.toUpperCase()}.`);
    if (titleKey) titles.set(titleKey, pageId);
  }
  return issues;
}

const scanMediaFields = (value: unknown, pageId: CmsPageId, path: string, media: Map<string, MediaRecord>, issues: CompletenessIssue[]) => {
  if (Array.isArray(value)) return value.forEach((item, index) => scanMediaFields(item, pageId, `${path}.${index}`, media, issues));
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  for (const [key, item] of Object.entries(record)) {
    const itemPath = path ? `${path}.${key}` : key;
    if (typeof item === 'string' && /^(thumbnail|image|profileImage|socialImage|assetPath|heroImage)$/i.test(key) && item) {
      if (key === 'assetPath' && item.startsWith('/archives/')) continue;
      const linked = [...media.values()].find((asset) => asset.id === item || asset.publicUrl === item || asset.storagePath === item);
      if (!linked) issues.push({ pageId, path: itemPath, message: 'Referenced media is missing from the library.', severity: 'error' });
      const altKey = key === 'thumbnail' ? 'thumbnailAlt' : key === 'profileImage' ? 'profileImageAlt' : key === 'socialImage' ? '' : 'imageAlt';
      if (altKey && typeof record[altKey] === 'string' && !(record[altKey] as string).trim()) issues.push({ pageId, path: path ? `${path}.${altKey}` : altKey, message: 'Image alt text is missing.', severity: 'error' });
    }
    scanMediaFields(item, pageId, itemPath, media, issues);
  }
};

export function analyzeCompleteness(pages: CmsPages, seo: SeoDocument, mediaRecords: MediaRecord[], resume: ResumeDocument) {
  const issues = validateSeoDocument(seo);
  const media = new Map(mediaRecords.map((record) => [record.id, record]));
  for (const pageId of CMS_PAGE_IDS) scanMediaFields(pages[pageId].data, pageId, '', media, issues);
  for (const record of mediaRecords) {
    for (const issue of validateMediaRecord(record)) issues.push({ pageId: 'media', path: `${record.id}.${issue.path}`, message: issue.message, severity: issue.path === 'dimensions' ? 'warning' : 'error' });
  }
  if (!resume.mediaId || !resume.publicUrl) issues.push({ pageId: 'resume', path: 'resume', message: 'No résumé version is selected.', severity: 'warning' });
  return issues;
}

export function sanitizeSeoDocument(value: unknown): SeoDocument {
  if (!value || typeof value !== 'object') return structuredClone(defaultSeoDocument);
  const candidate = value as Partial<SeoDocument>;
  const pages = structuredClone(defaultSeoDocument.pages);
  for (const pageId of CMS_PAGE_IDS) pages[pageId] = { ...pages[pageId], ...(candidate.pages?.[pageId] ?? {}) };
  return { schemaVersion: EDITORIAL_SCHEMA_VERSION, pages };
}

export function sanitizeResumeDocument(value: unknown): ResumeDocument {
  if (!value || typeof value !== 'object') return structuredClone(defaultResumeDocument);
  return { ...defaultResumeDocument, ...(value as Partial<ResumeDocument>), schemaVersion: EDITORIAL_SCHEMA_VERSION };
}
