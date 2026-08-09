import { SITE_FIELDS_PUBLISHED_KEY, defaultSiteFields, normalizeSiteFields } from '../data/siteFields';
import type { CmsPageId } from '../data/cmsSchema';
import { firebaseConfigured, getFirebaseServices } from '../lib/firebase';
import { renderPublishedPage } from './publicCmsRender';

const pageIdFromPath = (pathname: string) => {
  const segment = pathname.split('/').filter(Boolean)[0] ?? 'home';
  return segment === 'resume' ? 'about' : segment === 'archives' ? 'archives' : segment;
};

function setMeta(selector: string, value: string, attribute = 'content') {
  if (!value) return;
  document.querySelector<HTMLElement>(selector)?.setAttribute(attribute, value);
}

function applySeo(data: unknown) {
  if (!data || typeof data !== 'object') return;
  const pages = (data as { pages?: Record<string, Record<string, string>> }).pages;
  const seo = pages?.[pageIdFromPath(window.location.pathname)];
  if (!seo) return;
  const canonical = new URL(seo.canonicalPath || window.location.pathname, window.location.origin).href;
  if (seo.seoTitle) document.title = seo.seoTitle;
  setMeta('#site-meta-description', seo.seoDescription);
  setMeta('#site-canonical', canonical, 'href');
  setMeta('#site-og-title', seo.socialTitle || seo.seoTitle);
  setMeta('#site-og-description', seo.socialDescription || seo.seoDescription);
  setMeta('#site-og-url', canonical);
  const socialImage = seo.socialImage ? new URL(seo.socialImage, window.location.origin).href : '';
  setMeta('#site-og-image', socialImage);
  setMeta('#site-twitter-title', seo.socialTitle || seo.seoTitle);
  setMeta('#site-twitter-description', seo.socialDescription || seo.seoDescription);
  setMeta('#site-twitter-image', socialImage);
}

function applyResume(data: unknown) {
  const resume = data as { publicUrl?: string; fileName?: string } | null;
  document.querySelectorAll<HTMLAnchorElement>('[data-cms-resume-link]').forEach((link) => {
    link.href = '/resume/';
    if (resume?.fileName) link.title = `Current published résumé: ${resume.fileName}`;
  });
}

function applyFields(fields: Record<string, string>) {
  document.querySelectorAll<HTMLElement>('[data-cms-field]').forEach((element) => {
    const key = element.dataset.cmsField;
    if (!key || !(key in fields)) return;
    const value = fields[key];
    if (key in defaultSiteFields && value === defaultSiteFields[key]) return;
    const attribute = element.dataset.cmsAttribute;
    if (!attribute && element.textContent?.trim() === value) return;
    if (attribute === 'mailto' && element.getAttribute('href') === `mailto:${value}`) return;
    if (attribute && attribute !== 'mailto' && element.getAttribute(attribute) === value) return;
    if (attribute === 'mailto') {
      element.setAttribute('href', `mailto:${value}`);
      element.textContent = value;
    } else if (attribute) {
      element.setAttribute(attribute, value);
      if (element.dataset.cmsText === 'true') element.textContent = value;
    } else {
      element.textContent = value;
    }
  });
}

export async function loadSiteContent() {
  if (new URLSearchParams(window.location.search).get('cms-preview') === 'draft') {
    try {
      const payload = JSON.parse(sessionStorage.getItem('aniq-cms-public-preview') ?? '{}') as {
        fields?: Record<string, string>;
        pages?: Record<string, unknown>;
      };
      if (payload.fields) applyFields(normalizeSiteFields(payload.fields, payload.fields));
      const previewPageId = pageIdFromPath(window.location.pathname) as CmsPageId;
      if (payload.pages?.[previewPageId]) renderPublishedPage(previewPageId, payload.pages[previewPageId]);
      return;
    } catch (error) {
      console.warn('Draft preview content could not be loaded.', error);
    }
  }
  if (import.meta.env.DEV) {
    try {
      const local = localStorage.getItem(SITE_FIELDS_PUBLISHED_KEY);
      if (local) applyFields(normalizeSiteFields(JSON.parse(local)));
    } catch (error) {
      console.warn('Local page content could not be loaded.', error);
    }
  }

  if (!firebaseConfigured) return;
  try {
    const [services, firestore] = await Promise.all([getFirebaseServices(), import('firebase/firestore')]);
    if (!services) return;
    const pageId = pageIdFromPath(window.location.pathname);
    const supportsStructuredContent = ['about', 'experience', 'certifications', 'awards', 'leadership', 'archives'].includes(pageId);
    const [content, seo, resume, structuredPage] = await Promise.all([
      firestore.getDocFromServer(firestore.doc(services.db, 'siteContent', 'pages')),
      firestore.getDocFromServer(firestore.doc(services.db, 'cmsSeo', 'published')),
      firestore.getDocFromServer(firestore.doc(services.db, 'cmsResume', 'published')),
      supportsStructuredContent
        ? firestore.getDocFromServer(firestore.doc(services.db, 'cmsPublished', pageId))
        : Promise.resolve(null),
    ]);
    if (content.exists()) applyFields(normalizeSiteFields(content.data().fields));
    if (seo.exists()) applySeo(seo.data());
    if (resume.exists()) applyResume(resume.data());
    if (structuredPage?.exists()) renderPublishedPage(pageId as CmsPageId, structuredPage.data());
  } catch (error) {
    console.warn('Published page content could not be loaded.', error);
  }
}
