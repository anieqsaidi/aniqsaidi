import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp } from 'firebase/firestore';
import {
  CMS_PAGE_IDS,
  cmsV2ToV1,
  createRecordId,
  isCmsPage,
  migrateV1ToV2,
  sanitizeCmsPage,
  validateCmsPage,
  validateCmsPages,
  type CmsPage,
  type CmsPageId,
  type CmsPages,
  type CmsRecord,
} from '../data/cmsSchema';
import {
  changedPageIds,
  createRevisionId,
  pageChangeSummary,
  pageContent,
  pagesMatch,
  preparePublishedPage,
  type CmsRevision,
  type StoredCmsPage,
} from '../data/cmsWorkflow';
import { normalizeHomeContent } from '../data/homeContent';
import { normalizeSiteFields } from '../data/siteFields';
import { firebaseConfigured, getFirebaseServices } from '../lib/firebase';
import { auditPayload, recordAudit } from './adminOperations';

type InputType = 'text' | 'textarea' | 'email' | 'url' | 'month' | 'date' | 'checkbox' | 'select';
type NestedType = 'textRecords' | 'tagRecords' | 'sections';
type FieldConfig = { key: string; label: string; type?: InputType; options?: string[]; nested?: NestedType };
type CollectionConfig = { key: string; title: string; labelKey: string; fields: FieldConfig[] };
type PageConfig = { single?: FieldConfig[]; collections: CollectionConfig[] };

const configs: Record<CmsPageId, PageConfig> = {
  home: {
    single: [
      { key: 'profile.greeting', label: 'GREETING' }, { key: 'profile.role', label: 'ROLE' },
      { key: 'profile.location', label: 'LOCATION' }, { key: 'profile.email', label: 'EMAIL', type: 'email' },
      { key: 'profile.node', label: 'NODE' }, { key: 'profile.status', label: 'STATUS' },
      { key: 'profile.startCopy', label: 'START COPY', type: 'textarea' },
      { key: 'profile.progress', label: 'CURRENT PROGRESS', type: 'textarea' },
      { key: 'profile.linkedin', label: 'LINKEDIN', type: 'url' },
    ],
    collections: [
      { key: 'queue', title: 'ACTIVE QUEUE', labelKey: 'label', fields: [{ key: 'label', label: 'LABEL' }, { key: 'description', label: 'DESCRIPTION', type: 'textarea' }] },
      { key: 'callsToAction', title: 'CALLS TO ACTION', labelKey: 'label', fields: [{ key: 'label', label: 'LABEL' }, { key: 'url', label: 'URL', type: 'url' }, { key: 'external', label: 'EXTERNAL LINK', type: 'checkbox' }] },
    ],
  },
  about: {
    single: [
      { key: 'name', label: 'NAME' }, { key: 'role', label: 'ROLE' }, { key: 'location', label: 'LOCATION' },
      { key: 'email', label: 'EMAIL', type: 'email' }, { key: 'linkedin', label: 'LINKEDIN', type: 'url' },
    ],
    collections: [
      { key: 'education', title: 'EDUCATION RECORDS', labelKey: 'qualification', fields: [
        { key: 'qualification', label: 'QUALIFICATION' }, { key: 'institution', label: 'INSTITUTION' },
        { key: 'period', label: 'PERIOD' }, { key: 'earlierRecord', label: 'EARLIER RECORD', type: 'checkbox' },
      ] },
    ],
  },
  projects: {
    collections: [
      { key: 'projects', title: 'PROJECTS & CASE STUDIES', labelKey: 'title', fields: [
        { key: 'title', label: 'PROJECT TITLE' }, { key: 'slug', label: 'SLUG' },
        { key: 'shortDescription', label: 'SHORT DESCRIPTION', type: 'textarea' }, { key: 'category', label: 'CATEGORY' },
        { key: 'role', label: 'MY ROLE' }, { key: 'organisation', label: 'ORGANISATION' },
        { key: 'period', label: 'PERIOD' }, { key: 'projectStatus', label: 'PROJECT STATUS' },
        { key: 'featured', label: 'FEATURED', type: 'checkbox' }, { key: 'thumbnail', label: 'THUMBNAIL PATH' },
        { key: 'platforms', label: 'PLATFORMS', nested: 'tagRecords' },
        { key: 'technologies', label: 'TECHNOLOGIES', nested: 'tagRecords' },
        { key: 'referenceLabel', label: 'REFERENCE LABEL' }, { key: 'referenceUrl', label: 'REFERENCE URL', type: 'url' },
        { key: 'confidentialityNote', label: 'CONFIDENTIALITY NOTE', type: 'textarea' },
        { key: 'sections', label: 'CASE-STUDY SECTIONS', nested: 'sections' },
      ] },
    ],
  },
  experience: {
    collections: [
      { key: 'jobs', title: 'EXPERIENCE RECORDS', labelKey: 'role', fields: [
        { key: 'role', label: 'ROLE' }, { key: 'company', label: 'COMPANY' }, { key: 'location', label: 'LOCATION' },
        { key: 'period', label: 'DISPLAY PERIOD' }, { key: 'startDate', label: 'START', type: 'month' },
        { key: 'endDate', label: 'END', type: 'month' }, { key: 'current', label: 'CURRENT ROLE', type: 'checkbox' },
        { key: 'featured', label: 'FEATURED', type: 'checkbox' }, { key: 'highlights', label: 'OUTCOME POINTS', nested: 'textRecords' },
        { key: 'technologies', label: 'TECHNOLOGIES', nested: 'tagRecords' },
      ] },
      { key: 'toolkit', title: 'TOOLKIT GROUPS', labelKey: 'group', fields: [
        { key: 'group', label: 'GROUP' }, { key: 'technologies', label: 'SKILLS & TECHNOLOGIES', nested: 'tagRecords' },
      ] },
    ],
  },
  certifications: { collections: [{ key: 'certifications', title: 'CERTIFICATION RECORDS', labelKey: 'title', fields: [
    { key: 'title', label: 'TITLE' }, { key: 'issuer', label: 'ISSUER' }, { key: 'issuedAt', label: 'ISSUED' },
    { key: 'category', label: 'CATEGORY', type: 'select', options: ['professional', 'cloud', 'learning'] },
    { key: 'credentialUrl', label: 'CREDENTIAL URL', type: 'url' }, { key: 'featured', label: 'FEATURED', type: 'checkbox' },
  ] }] },
  awards: { collections: [{ key: 'awards', title: 'AWARD RECORDS', labelKey: 'title', fields: [
    { key: 'title', label: 'TITLE' }, { key: 'issuer', label: 'ISSUER' }, { key: 'date', label: 'DATE' },
    { key: 'description', label: 'DESCRIPTION', type: 'textarea' }, { key: 'category', label: 'CATEGORY' },
    { key: 'featured', label: 'FEATURED', type: 'checkbox' },
  ] }] },
  leadership: { collections: [{ key: 'leadership', title: 'LEADERSHIP RECORDS', labelKey: 'role', fields: [
    { key: 'role', label: 'ROLE' }, { key: 'organisation', label: 'ORGANISATION' }, { key: 'period', label: 'PERIOD' },
    { key: 'description', label: 'DESCRIPTION', type: 'textarea' }, { key: 'scope', label: 'SCOPE' },
    { key: 'earlierRecord', label: 'EARLIER RECORD', type: 'checkbox' }, { key: 'featured', label: 'FEATURED', type: 'checkbox' },
  ] }] },
  archives: {
    single: [{ key: 'lede', label: 'ARCHIVE INTRODUCTION', type: 'textarea' }],
    collections: [{ key: 'articles', title: 'ARCHIVE ARTICLES', labelKey: 'title', fields: [
      { key: 'title', label: 'TITLE' }, { key: 'slug', label: 'SLUG' }, { key: 'publication', label: 'PUBLICATION' },
      { key: 'publicationDate', label: 'PUBLICATION DATE', type: 'date' }, { key: 'description', label: 'DESCRIPTION', type: 'textarea' },
      { key: 'sourceUrl', label: 'SOURCE URL', type: 'url' }, { key: 'assetPath', label: 'ASSET PATH' },
      { key: 'language', label: 'LANGUAGE' }, { key: 'featured', label: 'FEATURED', type: 'checkbox' },
    ] }],
  },
};

const templates: Record<string, () => Record<string, unknown>> = {
  queue: () => ({ id: createRecordId('queue'), label: 'NEW ITEM', description: '', sortOrder: 0, status: 'draft' }),
  callsToAction: () => ({ id: createRecordId('cta'), label: 'NEW ACTION', url: '/', external: false, sortOrder: 0, status: 'draft' }),
  education: () => ({ id: createRecordId('education'), qualification: '', institution: '', period: '', earlierRecord: false, sortOrder: 0, status: 'draft' }),
  jobs: () => ({ id: createRecordId('experience'), role: '', company: '', location: '', period: '', startDate: '', endDate: '', current: false, featured: false, highlights: [], technologies: [], sortOrder: 0, status: 'draft' }),
  toolkit: () => ({ id: createRecordId('toolkit'), group: '', technologies: [], sortOrder: 0, status: 'draft' }),
  certifications: () => ({ id: createRecordId('certification'), title: '', issuer: '', issuedAt: '', category: 'learning', credentialUrl: '', featured: false, sortOrder: 0, status: 'draft' }),
  awards: () => ({ id: createRecordId('award'), title: '', issuer: '', date: '', description: '', category: '', featured: false, sortOrder: 0, status: 'draft' }),
  leadership: () => ({ id: createRecordId('leadership'), role: '', organisation: '', period: '', description: '', scope: '', earlierRecord: false, featured: false, sortOrder: 0, status: 'draft' }),
  articles: () => ({ id: createRecordId('archive'), slug: '', title: '', publication: '', publicationDate: '', description: '', sourceUrl: '', assetPath: '', language: '', featured: false, sortOrder: 0, status: 'draft' }),
  projects: () => ({ id: createRecordId('project'), slug: '', title: '', shortDescription: '', category: '', role: '', organisation: '', period: '', projectStatus: 'DRAFT', featured: false, thumbnail: '', platforms: [], technologies: [], referenceLabel: '', referenceUrl: '', confidentialityNote: '', sections: [], sortOrder: 0, status: 'draft' }),
};

const getAtPath = (source: unknown, path: string): unknown => path.split('.').reduce((value: unknown, key) =>
  value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, source);

const setAtPath = (source: unknown, path: string, value: unknown) => {
  const keys = path.split('.');
  const last = keys.pop()!;
  const target = keys.reduce((current: Record<string, unknown>, key) => current[key] as Record<string, unknown>, source as Record<string, unknown>);
  target[last] = value;
};

const button = (label: string, action: string, title = label) => {
  const element = document.createElement('button');
  element.type = 'button'; element.className = 'admin-mini-button'; element.dataset.action = action; element.textContent = label; element.title = title;
  return element;
};

const fieldControl = (field: FieldConfig, path: string, value: unknown) => {
  const label = document.createElement('label');
  label.className = field.type === 'checkbox' ? 'admin-field admin-field--check' : 'admin-field';
  const title = document.createElement('span'); title.textContent = field.label; label.append(title);
  let control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  if (field.type === 'textarea') {
    control = document.createElement('textarea'); control.rows = 3; control.value = String(value ?? '');
  } else if (field.type === 'select') {
    control = document.createElement('select');
    field.options?.forEach((option) => {
      const item = document.createElement('option'); item.value = option; item.textContent = option.toUpperCase(); item.selected = value === option; control.append(item);
    });
  } else {
    control = document.createElement('input'); control.type = field.type ?? 'text';
    if (field.type === 'checkbox') control.checked = Boolean(value); else control.value = String(value ?? '');
  }
  control.dataset.path = path; control.setAttribute('aria-label', field.label); label.append(control); return label;
};

const reidentify = (value: unknown, prefix = 'record'): unknown => {
  if (Array.isArray(value)) return value.map((item) => reidentify(item, prefix));
  if (!value || typeof value !== 'object') return value;
  const result = { ...(value as Record<string, unknown>) };
  if (typeof result.id === 'string') result.id = createRecordId(prefix);
  for (const [key, item] of Object.entries(result)) result[key] = reidentify(item, key);
  return result;
};

export async function initializeAdminCms() {
  const app = document.querySelector<HTMLElement>('#admin-app');
  const editor = document.querySelector<HTMLElement>('#admin-editor');
  const pageTitle = document.querySelector<HTMLElement>('#admin-page-title');
  const pageState = document.querySelector<HTMLElement>('#admin-page-state');
  const preview = document.querySelector<HTMLElement>('#admin-preview');
  const message = document.querySelector<HTMLElement>('#admin-message');
  const authPanel = document.querySelector<HTMLElement>('#admin-auth');
  const mode = document.querySelector<HTMLElement>('#admin-mode');
  const identity = document.querySelector<HTMLElement>('#admin-identity');
  const signInButton = document.querySelector<HTMLButtonElement>('#admin-sign-in');
  const signOutButton = document.querySelector<HTMLButtonElement>('#admin-sign-out');
  const saveButton = document.querySelector<HTMLButtonElement>('#admin-save');
  const saveAllButton = document.querySelector<HTMLButtonElement>('#admin-save-all');
  const previewButton = document.querySelector<HTMLButtonElement>('#admin-preview-draft');
  const publishPageButton = document.querySelector<HTMLButtonElement>('#admin-publish-page');
  const publishButton = document.querySelector<HTMLButtonElement>('#admin-publish');
  const previewDialog = document.querySelector<HTMLDialogElement>('#admin-preview-dialog');
  const previewClose = document.querySelector<HTMLButtonElement>('#admin-preview-close');
  const previewStage = document.querySelector<HTMLElement>('#admin-preview-stage');
  const previewFrame = document.querySelector<HTMLIFrameElement>('#admin-public-preview');
  const previewTitle = document.querySelector<HTMLElement>('#admin-preview-title');
  if (!app || !editor || !pageTitle || !preview) throw new Error('Admin CMS failed to initialize.');

  let pages = JSON.parse(app.dataset.defaults ?? '{}') as CmsPages;
  let publishedPages = structuredClone(pages) as CmsPages;
  publishedPages.projects.data.projects = [];
  const requestedPage = new URLSearchParams(window.location.search).get('page');
  let selectedPage: CmsPageId = CMS_PAGE_IDS.includes(requestedPage as CmsPageId) ? requestedPage as CmsPageId : 'home';
  let migrationPending = false;
  let previewSource: 'draft' | 'live' = 'draft';
  const dirtyPages = new Set<CmsPageId>();
  const savingPages = new Set<CmsPageId>();
  const saveAgain = new Set<CmsPageId>();
  const saveTimers = new Map<CmsPageId, number>();
  const savePromises = new Map<CmsPageId, Promise<void>>();
  const revisionCache = new Map<string, CmsRevision>();
  const draftVersions = Object.fromEntries(CMS_PAGE_IDS.map((pageId) => [pageId, 0])) as Record<CmsPageId, number>;
  const publishedVersions = Object.fromEntries(CMS_PAGE_IDS.map((pageId) => [pageId, 0])) as Record<CmsPageId, number>;
  const publishedRevisionIds = Object.fromEntries(CMS_PAGE_IDS.map((pageId) => [pageId, ''])) as Record<CmsPageId, string>;
  const adminUid = app.dataset.adminUid ?? '';
  const adminEmail = (app.dataset.adminEmail ?? '').toLowerCase();
  const services = await getFirebaseServices();
  const isConflict = (error: unknown) => error instanceof Error && error.message.startsWith('CMS_CONFLICT:');
  const errorCode = (error: unknown) => {
    const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code ?? '') : '';
    return code.replace(/^firestore\//, '').replace(/^auth\//, '').toUpperCase() || 'UNKNOWN ERROR';
  };

  const setMessage = (text: string, error = false) => {
    if (!message) return; message.textContent = text; message.classList.toggle('is-error', error);
  };

  const syncControls = () => {
    const unresolved = savingPages.size > 0;
    if (saveButton) saveButton.disabled = unresolved;
    if (saveAllButton) saveAllButton.disabled = unresolved;
    if (publishPageButton) publishPageButton.disabled = unresolved;
    if (publishButton) publishButton.disabled = unresolved;
    if (pageState) {
      const state = savingPages.has(selectedPage) ? 'SAVING...'
        : dirtyPages.has(selectedPage) ? 'EDITING // AUTOSAVE PENDING'
          : !pagesMatch(pages[selectedPage], publishedPages[selectedPage]) ? 'DRAFT SAVED // MODIFIED'
            : migrationPending ? 'V1 MIGRATION READY' : 'LIVE // DRAFT MATCH';
      pageState.textContent = state;
    }
  };

  const scheduleAutosave = (pageId: CmsPageId, delay = 1400) => {
    const previous = saveTimers.get(pageId); if (previous) window.clearTimeout(previous);
    saveTimers.set(pageId, window.setTimeout(() => { void saveDraft(pageId, 'Autosaved draft'); }, delay));
  };

  const setDirty = (value = true, pageId = selectedPage) => {
    if (value) { dirtyPages.add(pageId); scheduleAutosave(pageId); } else dirtyPages.delete(pageId);
    syncControls();
  };

  const renderNested = (type: NestedType, records: Array<Record<string, unknown>>, path: string) => {
    const wrap = document.createElement('div'); wrap.className = `admin-nested admin-nested--${type}`;
    records.forEach((record, index) => {
      const row = document.createElement('div'); row.className = 'admin-nested-row';
      const controls = document.createElement('div'); controls.className = 'admin-nested-actions';
      [['↑','nested-up'],['↓','nested-down'],['×','nested-delete']].forEach(([label, action]) => {
        const item = button(label, action); item.dataset.path = path; item.dataset.index = String(index); controls.append(item);
      });
      row.append(controls);
      if (type === 'sections') {
        const sectionGrid = document.createElement('div'); sectionGrid.className = 'admin-section-grid';
        sectionGrid.append(
          fieldControl({ key: 'type', label: 'TYPE', type: 'select', options: ['problem','role','constraints','solution','architecture','challenges','outcomes','reflection'] }, `${path}.${index}.type`, record.type),
          fieldControl({ key: 'heading', label: 'HEADING' }, `${path}.${index}.heading`, record.heading),
          fieldControl({ key: 'body', label: 'BODY', type: 'textarea' }, `${path}.${index}.body`, record.body),
        );
        const points = renderNested('textRecords', (record.points as Array<Record<string, unknown>>) ?? [], `${path}.${index}.points`);
        sectionGrid.append(points); row.append(sectionGrid);
      } else {
        row.append(fieldControl({ key: type === 'tagRecords' ? 'label' : 'text', label: type === 'tagRecords' ? 'TAG' : 'POINT' }, `${path}.${index}.${type === 'tagRecords' ? 'label' : 'text'}`, record[type === 'tagRecords' ? 'label' : 'text']));
      }
      wrap.append(row);
    });
    const add = button(type === 'sections' ? '+ ADD SECTION' : type === 'tagRecords' ? '+ ADD TAG' : '+ ADD POINT', 'nested-add');
    add.dataset.path = path; add.dataset.nestedType = type; wrap.append(add); return wrap;
  };

  const renderCollection = (config: CollectionConfig, recordsInput: Array<Record<string, unknown>>) => {
    const section = document.createElement('section'); section.className = 'admin-collection';
    const header = document.createElement('header');
    const heading = document.createElement('h3'); heading.textContent = `${config.title} // ${recordsInput.length}`;
    const add = button('+ ADD RECORD', 'add'); add.dataset.collection = config.key; header.append(heading, add); section.append(header);
    const records = [...recordsInput].sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
    records.forEach((record, displayedIndex) => {
      const actualIndex = recordsInput.indexOf(record);
      const details = document.createElement('details'); details.className = 'admin-record'; details.open = displayedIndex === 0;
      const summary = document.createElement('summary');
      const label = String(record[config.labelKey] || 'UNTITLED RECORD');
      summary.textContent = `${String(displayedIndex + 1).padStart(2, '0')} // ${label}`;
      const badge = document.createElement('span'); badge.textContent = String(record.status ?? 'draft').toUpperCase(); summary.append(badge); details.append(summary);
      const body = document.createElement('div'); body.className = 'admin-record-body';
      const metadata = document.createElement('div'); metadata.className = 'admin-record-meta';
      metadata.append(fieldControl({ key: 'id', label: 'STABLE ID' }, `data.${config.key}.${actualIndex}.id`, record.id));
      const idInput = metadata.querySelector<HTMLInputElement>('input'); if (idInput) idInput.readOnly = true;
      metadata.append(fieldControl({ key: 'status', label: 'STATUS', type: 'select', options: ['draft','published','archived'] }, `data.${config.key}.${actualIndex}.status`, record.status));
      body.append(metadata);
      const fields = document.createElement('div'); fields.className = 'admin-record-fields';
      config.fields.forEach((field) => {
        const path = `data.${config.key}.${actualIndex}.${field.key}`;
        if (field.nested) {
          const group = document.createElement('fieldset'); group.className = 'admin-nested-field';
          const legend = document.createElement('legend'); legend.textContent = field.label; group.append(legend, renderNested(field.nested, (record[field.key] as Array<Record<string, unknown>>) ?? [], path)); fields.append(group);
        } else fields.append(fieldControl(field, path, record[field.key]));
      });
      body.append(fields);
      const actions = document.createElement('div'); actions.className = 'admin-record-actions';
      [['↑ MOVE UP','up'],['↓ MOVE DOWN','down'],['⧉ DUPLICATE','duplicate'],[record.status === 'archived' ? '↺ RESTORE' : '□ ARCHIVE','archive'],['× DELETE','delete']].forEach(([labelText, action]) => {
        const control = button(labelText, action); control.dataset.collection = config.key; control.dataset.index = String(actualIndex); actions.append(control);
      });
      body.append(actions); details.append(body); section.append(details);
    });
    return section;
  };

  const renderPreview = () => {
    const page = pages[selectedPage]; const config = configs[selectedPage];
    preview.replaceChildren();
    const statusLine = document.createElement('p'); statusLine.className = 'admin-preview-status';
    const issues = validateCmsPage(page);
    statusLine.textContent = issues.length ? `VALIDATION // ${issues.length} ISSUE${issues.length === 1 ? '' : 'S'}` : 'VALIDATION // READY'; preview.append(statusLine);
    if (issues.length) {
      const list = document.createElement('ul'); issues.slice(0, 8).forEach((issue) => { const item = document.createElement('li'); item.textContent = `${issue.path}: ${issue.message}`; list.append(item); }); preview.append(list);
    }
    config.collections.forEach((collection) => {
      const records = getAtPath(page, `data.${collection.key}`) as CmsRecord[];
      const line = document.createElement('article');
      const heading = document.createElement('strong'); heading.textContent = collection.title;
      const copy = document.createElement('p');
      const active = records.filter((record) => record.status !== 'archived').length;
      const drafts = records.filter((record) => record.status === 'draft').length;
      copy.textContent = `${active} ACTIVE // ${drafts} DRAFT // ${records.length - active} ARCHIVED`; line.append(heading, copy); preview.append(line);
    });
    const live = document.createElement('article');
    const liveHeading = document.createElement('strong'); liveHeading.textContent = 'PUBLICATION STATE';
    const liveCopy = document.createElement('p');
    liveCopy.textContent = pagesMatch(page, publishedPages[selectedPage]) ? 'LIVE // DRAFT MATCH' : 'DRAFT MODIFIED // UNPUBLISHED';
    live.append(liveHeading, liveCopy); preview.append(live);
    const revisions = document.createElement('section'); revisions.className = 'admin-revisions'; revisions.dataset.revisionsFor = selectedPage;
    const revisionsHeading = document.createElement('strong'); revisionsHeading.textContent = 'REVISION HISTORY';
    const loading = document.createElement('small'); loading.textContent = 'LOADING...'; revisions.append(revisionsHeading, loading); preview.append(revisions);
    void loadRevisionHistory(selectedPage, revisions);
  };

  const renderFieldErrors = () => {
    editor.querySelectorAll('.admin-field-error').forEach((item) => item.remove());
    editor.querySelectorAll<HTMLElement>('[aria-invalid]').forEach((item) => {
      item.removeAttribute('aria-invalid'); item.removeAttribute('aria-describedby');
    });
    validateCmsPage(pages[selectedPage]).forEach((issue, index) => {
      const issuePath = issue.path.startsWith('data.') ? issue.path : `data.${issue.path}`;
      const control = [...editor.querySelectorAll<HTMLElement>('[data-path]')].find((item) => item.dataset.path === issuePath);
      if (!control) return;
      const error = document.createElement('small');
      error.className = 'admin-field-error'; error.id = `admin-field-error-${index}`; error.textContent = issue.message;
      control.setAttribute('aria-invalid', 'true'); control.setAttribute('aria-describedby', error.id);
      (control.closest('.admin-field') ?? control.parentElement)?.append(error);
    });
  };

  const render = () => {
    const page = pages[selectedPage]; const config = configs[selectedPage];
    pageTitle.textContent = `${page.title}.SYS // STRUCTURED EDITOR`; editor.replaceChildren();
    if (config.single?.length) {
      const section = document.createElement('section'); section.className = 'admin-single-fields';
      const heading = document.createElement('h3'); heading.textContent = 'PAGE FIELDS'; section.append(heading);
      const grid = document.createElement('div'); grid.className = 'admin-record-fields';
      config.single.forEach((field) => grid.append(fieldControl(field, `data.${field.key}`, getAtPath(page, `data.${field.key}`)))); section.append(grid); editor.append(section);
    }
    config.collections.forEach((collection) => editor.append(renderCollection(collection, getAtPath(page, `data.${collection.key}`) as Array<Record<string, unknown>>)));
    document.querySelectorAll<HTMLButtonElement>('[data-admin-page]').forEach((item) => {
      item.classList.toggle('is-active', item.dataset.adminPage === selectedPage); item.setAttribute('aria-current', item.dataset.adminPage === selectedPage ? 'page' : 'false');
    });
    renderPreview();
    renderFieldErrors();
    syncControls();
  };

  const collection = (key: string) => getAtPath(pages[selectedPage], `data.${key}`) as Array<Record<string, unknown>>;
  const reindex = (records: Array<Record<string, unknown>>) => records.forEach((record, index) => { record.sortOrder = index; });

  editor.addEventListener('input', (event) => {
    const control = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    if (!control.dataset.path) return;
    setAtPath(pages[selectedPage], control.dataset.path, control instanceof HTMLInputElement && control.type === 'checkbox' ? control.checked : control.value);
    setDirty(); renderPreview(); renderFieldErrors();
  });

  editor.addEventListener('click', (event) => {
    const control = (event.target as Element).closest<HTMLButtonElement>('[data-action]'); if (!control) return;
    const action = control.dataset.action!;
    if (action.startsWith('nested-')) {
      const path = control.dataset.path!; const records = getAtPath(pages[selectedPage], path) as Array<Record<string, unknown>>;
      const index = Number(control.dataset.index);
      if (action === 'nested-add') {
        const type = control.dataset.nestedType;
        records.push(type === 'sections'
          ? { id: createRecordId('section'), type: 'problem', heading: 'New section', body: '', points: [], sortOrder: records.length, status: 'draft' }
          : { id: createRecordId(type === 'tagRecords' ? 'tag' : 'point'), [type === 'tagRecords' ? 'label' : 'text']: '', sortOrder: records.length, status: 'draft' });
      } else if (action === 'nested-delete') records.splice(index, 1);
      else if (action === 'nested-up' && index > 0) [records[index - 1], records[index]] = [records[index], records[index - 1]];
      else if (action === 'nested-down' && index < records.length - 1) [records[index + 1], records[index]] = [records[index], records[index + 1]];
      reindex(records); setDirty(); render(); return;
    }
    const key = control.dataset.collection!; const records = collection(key);
    if (action === 'add') records.push({ ...templates[key](), sortOrder: records.length });
    else {
      const index = Number(control.dataset.index); const record = records[index]; if (!record) return;
      if (action === 'up' && index > 0) [records[index - 1], records[index]] = [records[index], records[index - 1]];
      if (action === 'down' && index < records.length - 1) [records[index + 1], records[index]] = [records[index], records[index + 1]];
      if (action === 'duplicate') records.splice(index + 1, 0, reidentify(record, key) as Record<string, unknown>);
      if (action === 'archive') {
        const restoring = record.status === 'archived'; record.status = restoring ? 'draft' : 'archived';
        if (services?.auth.currentUser) void recordAudit(services, restoring ? 'record.restore' : 'record.archive', key, String(record.id ?? ''), `${restoring ? 'Restored' : 'Archived'} ${String(record[configs[selectedPage].collections.find((item) => item.key === key)?.labelKey ?? 'id'])} in ${selectedPage} draft`).catch(console.error);
      }
      if (action === 'delete' && window.confirm(`Delete “${String(record[configs[selectedPage].collections.find((item) => item.key === key)?.labelKey ?? 'id'])}” from this draft?`)) {
        records.splice(index, 1);
        if (services?.auth.currentUser) void recordAudit(services, 'record.delete', key, String(record.id ?? ''), `Deleted ${String(record[configs[selectedPage].collections.find((item) => item.key === key)?.labelKey ?? 'id'])} from ${selectedPage} draft`).catch(console.error);
      }
    }
    reindex(records); setDirty(); render();
  });

  document.querySelectorAll<HTMLButtonElement>('[data-admin-page]').forEach((button) => button.addEventListener('click', () => {
    selectedPage = button.dataset.adminPage as CmsPageId;
    window.history.replaceState(null, '', `/admin/?page=${selectedPage}`); render();
  }));

  const revisionPayload = (
    revisionId: string,
    pageId: CmsPageId,
    state: 'draft' | 'published',
    content: CmsPage,
    summary: string,
    note = '',
  ) => ({
    revisionId, pageId, state, content: pageContent(content), summary, note,
    editorUid: services?.auth.currentUser?.uid ?? '',
    editorEmail: services?.auth.currentUser?.email ?? '',
    createdAt: serverTimestamp(),
    previousPublishedRevisionId: publishedRevisionIds[pageId],
  });

  const formatDate = (value: unknown) => {
    const date = value && typeof value === 'object' && 'toDate' in value
      ? (value as { toDate: () => Date }).toDate() : null;
    return date ? new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kuala_Lumpur' }).format(date) : 'PENDING';
  };

  const loadRevisionHistory = async (pageId: CmsPageId, target: HTMLElement) => {
    if (!services?.auth.currentUser) { target.querySelector('small')!.textContent = 'AUTHENTICATION REQUIRED'; return; }
    try {
      const snapshots = await getDocs(query(collection(services.db, 'cmsRevisions', pageId, 'items'), orderBy('createdAt', 'desc'), limit(10)));
      if (target.dataset.revisionsFor !== selectedPage) return;
      target.querySelector('small')?.remove();
      if (snapshots.empty) { const empty = document.createElement('small'); empty.textContent = 'NO REVISIONS YET'; target.append(empty); return; }
      snapshots.forEach((snapshot) => {
        const revision = snapshot.data() as CmsRevision; revisionCache.set(revision.revisionId, revision);
        const row = document.createElement('article'); row.className = 'admin-revision';
        const title = document.createElement('strong'); title.textContent = `${revision.state.toUpperCase()} // ${formatDate(revision.createdAt)}`;
        const copy = document.createElement('small');
        copy.textContent = `${revision.summary} // DRAFT ${pagesMatch(revision.content, pages[pageId]) ? 'MATCH' : 'DIFF'} // LIVE ${pagesMatch(revision.content, publishedPages[pageId]) ? 'MATCH' : 'DIFF'}`;
        const actions = document.createElement('div');
        [['VIEW','revision-view'],['RESTORE AS DRAFT','revision-restore'],['REPUBLISH','revision-republish']].forEach(([label, action]) => {
          const control = button(label, action); control.dataset.revisionId = revision.revisionId; actions.append(control);
        });
        row.append(title, copy, actions); target.append(row);
      });
    } catch (error) { console.error(error); const status = target.querySelector('small'); if (status) status.textContent = `REVISION LOAD FAILED // ${errorCode(error)}`; }
  };

  const saveDraft = (pageId: CmsPageId, summary = 'Draft saved'): Promise<void> => {
    if (savingPages.has(pageId)) {
      saveAgain.add(pageId);
      return savePromises.get(pageId) ?? Promise.resolve();
    }
    const timer = saveTimers.get(pageId); if (timer) window.clearTimeout(timer); saveTimers.delete(pageId);
    if (!services?.auth.currentUser) {
      setMessage('OFFLINE // DRAFT NOT SAVED. AUTHENTICATION REQUIRED.', true); syncControls(); return Promise.resolve();
    }
    const snapshot = pageContent(pages[pageId]);
    const revisionId = createRevisionId(pageId, 'draft');
    const nextVersion = draftVersions[pageId] + 1;
    dirtyPages.delete(pageId); savingPages.add(pageId); syncControls(); setMessage(`SAVING ${snapshot.title} DRAFT...`);
    const operation = (async () => {
      let failed = false;
      let conflicted = false;
      try {
        const actor = services.auth.currentUser!.uid;
        await runTransaction(services.db, async (transaction) => {
          const draftRef = doc(services.db, 'cmsDrafts', pageId);
          const remote = await transaction.get(draftRef);
          const remoteVersion = Number(remote.data()?.version ?? 0);
          if (remoteVersion !== draftVersions[pageId]) throw new Error(`CMS_CONFLICT:${pageId}`);
          transaction.set(draftRef, { ...snapshot, updatedAt: serverTimestamp(), updatedBy: actor, version: nextVersion, draftRevisionId: revisionId });
          transaction.set(doc(services.db, 'cmsRevisions', pageId, 'items', revisionId), revisionPayload(revisionId, pageId, 'draft', snapshot, summary));
          const audit = auditPayload(services, 'draft.save', 'page', pageId, summary, revisionId);
          transaction.set(doc(services.db, 'cmsAudit', audit.id), audit);
        });
        draftVersions[pageId] = nextVersion; migrationPending = false;
        setMessage(`${snapshot.title} // DRAFT SAVED ${new Intl.DateTimeFormat('en-MY', { timeStyle: 'medium', timeZone: 'Asia/Kuala_Lumpur' }).format(new Date())} MYT`);
      } catch (error) {
        failed = true; conflicted = isConflict(error); console.error(error); dirtyPages.add(pageId);
        setMessage(isConflict(error) ? `SAVE CONFLICT // ${pageId.toUpperCase()} CHANGED IN ANOTHER TAB OR DEVICE. RELOAD BEFORE SAVING.` : `SAVE FAILED // ${errorCode(error)} // DRAFT RETAINED IN THIS TAB.`, true);
      } finally {
        savingPages.delete(pageId); savePromises.delete(pageId); syncControls();
        const newerChanges = saveAgain.delete(pageId);
        if (failed) { if (!conflicted) scheduleAutosave(pageId, navigator.onLine ? 8000 : 30000); }
        else if (newerChanges || dirtyPages.has(pageId)) await saveDraft(pageId, 'Autosaved newer draft');
        else if (pageId === selectedPage) renderPreview();
      }
    })();
    savePromises.set(pageId, operation); return operation;
  };

  const publishPage = async (pageId: CmsPageId, source = pages[pageId], note = '') => {
    if (!services?.auth.currentUser) return setMessage('PUBLISH BLOCKED: AUTHENTICATION REQUIRED.', true);
    if (source === pages[pageId] && (dirtyPages.has(pageId) || savingPages.has(pageId))) await saveDraft(pageId, 'Draft saved before publishing');
    if (source === pages[pageId] && dirtyPages.has(pageId)) return setMessage('PUBLISH BLOCKED: DRAFT SAVE HAS NOT SUCCEEDED.', true);
    const promoted = preparePublishedPage(source) as CmsPages[typeof pageId];
    const issues = validateCmsPage(promoted);
    if (issues.length) { setMessage(`PUBLISH BLOCKED: ${issues[0].path} — ${issues[0].message}`, true); renderPreview(); return; }
    const summary = pageChangeSummary(source, publishedPages[pageId]);
    const revisionId = createRevisionId(pageId, 'published');
    const nextVersion = publishedVersions[pageId] + 1;
    const actor = services.auth.currentUser.uid;
    if (publishPageButton) publishPageButton.disabled = true; if (publishButton) publishButton.disabled = true;
    setMessage(`PUBLISHING ${source.title} ATOMICALLY...`);
    try {
      await runTransaction(services.db, async (transaction) => {
        const publishedRef = doc(services.db, 'cmsPublished', pageId);
        const remote = await transaction.get(publishedRef);
        if (Number(remote.data()?.version ?? 0) !== publishedVersions[pageId]) throw new Error(`CMS_CONFLICT:${pageId}`);
        transaction.set(publishedRef, {
          ...promoted, updatedAt: serverTimestamp(), publishedAt: serverTimestamp(), updatedBy: actor,
          version: nextVersion, publishedRevisionId: revisionId,
        });
        transaction.set(doc(services.db, 'cmsRevisions', pageId, 'items', revisionId), revisionPayload(revisionId, pageId, 'published', promoted, summary, note));
        const audit = auditPayload(services, note.startsWith('Republished from') ? 'revision.republish' : 'page.publish', 'page', pageId, note || summary, revisionId);
        transaction.set(doc(services.db, 'cmsAudit', audit.id), audit);
      });
      publishedPages[pageId] = promoted as never; publishedVersions[pageId] = nextVersion; publishedRevisionIds[pageId] = revisionId;
      setMessage(`${source.title} // PUBLISHED. LIVE SITE UPDATED ATOMICALLY.`); render();
    } catch (error) { console.error(error); setMessage(isConflict(error) ? `PUBLISH CONFLICT // ${pageId.toUpperCase()} CHANGED IN ANOTHER TAB OR DEVICE. RELOAD BEFORE PUBLISHING.` : `PUBLISH FAILED // ${errorCode(error)} // LIVE CONTENT WAS NOT CHANGED.`, true); }
    finally { syncControls(); }
  };

  const appendPreviewValue = (parent: HTMLElement, key: string, value: unknown) => {
    if (value === '' || value == null || ['id','sortOrder','status','featured','external','earlierRecord'].includes(key)) return;
    if (Array.isArray(value)) {
      value.filter((item) => !item || typeof item !== 'object' || (item as CmsRecord).status !== 'archived').forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const record = item as Record<string, unknown>;
        const block = document.createElement('section'); block.className = 'cms-preview-block';
        const heading = document.createElement('h4'); heading.textContent = String(record.title ?? record.role ?? record.label ?? record.qualification ?? record.group ?? record.heading ?? key).toUpperCase(); block.append(heading);
        Object.entries(record).forEach(([childKey, child]) => appendPreviewValue(block, childKey, child)); parent.append(block);
      });
      return;
    }
    if (typeof value === 'object') { Object.entries(value as Record<string, unknown>).forEach(([childKey, child]) => appendPreviewValue(parent, childKey, child)); return; }
    const copy = document.createElement('p'); copy.textContent = `${key.replace(/([A-Z])/g, ' $1').toUpperCase()} // ${String(value)}`; parent.append(copy);
  };

  const showPreview = (source: 'draft' | 'live' = previewSource, override?: CmsPage) => {
    if (!previewDialog || !previewFrame) return;
    previewSource = source;
    const page = override ?? (source === 'draft' ? pages[selectedPage] : publishedPages[selectedPage]);
    const previewPages = structuredClone(source === 'draft' ? pages : publishedPages) as CmsPages;
    previewPages[selectedPage] = page as never;
    const legacy = cmsV2ToV1(previewPages);
    sessionStorage.setItem('aniq-cms-public-preview', JSON.stringify({ home: legacy.home, fields: legacy.fields, projects: previewPages.projects, pages: previewPages }));
    const paths: Record<CmsPageId, string> = { home: '/', about: '/about/', projects: '/projects/', experience: '/experience/', certifications: '/certifications/', awards: '/awards/', leadership: '/leadership/', archives: '/archives/' };
    previewFrame.src = `${paths[selectedPage]}?cms-preview=${override ? 'draft' : source}&v=${Date.now()}`;
    if (previewTitle) previewTitle.textContent = `${override ? 'REVISION' : source.toUpperCase()} PREVIEW // ${page.title}`;
    document.querySelectorAll<HTMLButtonElement>('[data-preview-source]').forEach((control) => control.classList.toggle('is-active', !override && control.dataset.previewSource === source));
    if (!previewDialog.open) previewDialog.showModal();
  };

  const loadCloudPages = async () => {
    if (!services) return;
    const [draftSnapshots, publishedSnapshots, homeDraft, pagesDraft, homeLive, pagesLive] = await Promise.all([
      Promise.all(CMS_PAGE_IDS.map((pageId) => getDoc(doc(services.db, 'cmsDrafts', pageId)))),
      Promise.all(CMS_PAGE_IDS.map((pageId) => getDoc(doc(services.db, 'cmsPublished', pageId)))),
      getDoc(doc(services.db, 'siteDrafts', 'home')), getDoc(doc(services.db, 'siteDrafts', 'pages')),
      getDoc(doc(services.db, 'siteContent', 'home')), getDoc(doc(services.db, 'siteContent', 'pages')),
    ]);
    const liveHome = homeLive.exists() ? homeLive.data() : null;
    const liveFields = pagesLive.exists() ? pagesLive.data().fields : null;
    if (liveHome && liveFields) {
      publishedPages = migrateV1ToV2(normalizeHomeContent(liveHome), normalizeSiteFields(liveFields, liveFields));
      publishedPages.projects.data.projects = [];
    }
    const sourceHome = homeDraft.exists() ? homeDraft.data() : liveHome;
    const sourceFields = pagesDraft.exists() ? pagesDraft.data().fields : liveFields;
    if (sourceHome && sourceFields) {
      pages = migrateV1ToV2(normalizeHomeContent(sourceHome), normalizeSiteFields(sourceFields, sourceFields));
    }
    let found = 0;
    draftSnapshots.forEach((snapshot, index) => {
      const pageId = CMS_PAGE_IDS[index];
      if (snapshot.exists() && isCmsPage(snapshot.data(), pageId)) {
        const stored = snapshot.data() as StoredCmsPage;
        pages[pageId] = sanitizeCmsPage(stored, pages[pageId]) as never; draftVersions[pageId] = stored.version ?? 0; found += 1;
      }
    });
    publishedSnapshots.forEach((snapshot, index) => {
      const pageId = CMS_PAGE_IDS[index];
      if (snapshot.exists() && isCmsPage(snapshot.data(), pageId)) {
        const stored = snapshot.data() as StoredCmsPage;
        publishedPages[pageId] = sanitizeCmsPage(stored, publishedPages[pageId]) as never;
        publishedVersions[pageId] = stored.version ?? 0; publishedRevisionIds[pageId] = stored.publishedRevisionId ?? '';
      }
    });
    migrationPending = found < CMS_PAGE_IDS.length;
    setMessage(migrationPending
      ? `V1 BASELINE READY; ${found}/${CMS_PAGE_IDS.length} V2 DRAFTS EXIST. SAVE ALL TO COMPLETE MIGRATION.`
      : `${changedPageIds(pages, publishedPages).length} PAGE${changedPageIds(pages, publishedPages).length === 1 ? '' : 'S'} WITH UNPUBLISHED CHANGES.`);
  };

  saveButton?.addEventListener('click', () => { void saveDraft(selectedPage, 'Manual draft save'); });

  saveAllButton?.addEventListener('click', async () => {
    if (!services?.auth.currentUser) return setMessage('SAVE ALL BLOCKED: AUTHENTICATION REQUIRED.', true);
    await Promise.all(CMS_PAGE_IDS.map((pageId) => saveDraft(pageId, 'Manual save all')));
    setMessage('ALL 8 PAGE DRAFTS SAVED. LIVE CONTENT WAS NOT CHANGED.');
  });

  publishPageButton?.addEventListener('click', async () => {
    const summary = pageChangeSummary(pages[selectedPage], publishedPages[selectedPage]);
    if (!window.confirm(`PUBLISH ${pages[selectedPage].title}?\n\n${summary}\n\nOnly records marked PUBLISHED will become public.`)) return;
    await publishPage(selectedPage);
  });

  publishButton?.addEventListener('click', async () => {
    if (!services?.auth.currentUser) return setMessage('PUBLISH BLOCKED: AUTHENTICATION REQUIRED.', true);
    const changed = changedPageIds(pages, publishedPages);
    const summary = changed.length ? changed.map((pageId) => `- ${pageChangeSummary(pages[pageId], publishedPages[pageId])}`).join('\n') : '- No detected changes; a new published revision will still be recorded.';
    if (!window.confirm(`PUBLISH ALL 8 PAGES ATOMICALLY?\n\n${summary}\n\nOnly records marked PUBLISHED will become public.`)) return;
    await Promise.all(CMS_PAGE_IDS.filter((pageId) => dirtyPages.has(pageId) || savingPages.has(pageId)).map((pageId) => saveDraft(pageId, 'Draft saved before bulk publish')));
    if (dirtyPages.size) return setMessage('PUBLISH ALL BLOCKED: ONE OR MORE DRAFT SAVES HAVE NOT SUCCEEDED.', true);
    const promoted = Object.fromEntries(CMS_PAGE_IDS.map((pageId) => [pageId, preparePublishedPage(pages[pageId])])) as unknown as CmsPages;
    const issues = validateCmsPages(promoted);
    if (issues.length) return setMessage(`PUBLISH ALL BLOCKED: ${issues[0].path} — ${issues[0].message}`, true);
    publishButton.disabled = true; if (publishPageButton) publishPageButton.disabled = true; setMessage('PUBLISHING ALL 8 PAGES IN ONE ATOMIC BATCH...');
    try {
      const actor = services.auth.currentUser.uid;
      const revisionIds = Object.fromEntries(CMS_PAGE_IDS.map((pageId) => [pageId, createRevisionId(pageId, 'published')])) as Record<CmsPageId, string>;
      const nextVersions = Object.fromEntries(CMS_PAGE_IDS.map((pageId) => [pageId, publishedVersions[pageId] + 1])) as Record<CmsPageId, number>;
      await runTransaction(services.db, async (transaction) => {
        const publishedRefs = CMS_PAGE_IDS.map((pageId) => doc(services.db, 'cmsPublished', pageId));
        const remotePages = await Promise.all(publishedRefs.map((item) => transaction.get(item)));
        remotePages.forEach((snapshot, index) => {
          const pageId = CMS_PAGE_IDS[index];
          if (Number(snapshot.data()?.version ?? 0) !== publishedVersions[pageId]) throw new Error(`CMS_CONFLICT:${pageId}`);
        });
        CMS_PAGE_IDS.forEach((pageId, index) => {
          const revisionId = revisionIds[pageId];
          transaction.set(publishedRefs[index], {
            ...promoted[pageId], updatedAt: serverTimestamp(), publishedAt: serverTimestamp(), updatedBy: actor,
            version: nextVersions[pageId], publishedRevisionId: revisionId,
          });
          transaction.set(doc(services.db, 'cmsRevisions', pageId, 'items', revisionId), revisionPayload(
            revisionId, pageId, 'published', promoted[pageId], pageChangeSummary(pages[pageId], publishedPages[pageId]), 'Bulk publication',
          ));
        });
        const audit = auditPayload(services, 'site.publish', 'site', 'all', 'Published all 8 pages atomically');
        transaction.set(doc(services.db, 'cmsAudit', audit.id), audit);
      });
      CMS_PAGE_IDS.forEach((pageId) => { publishedVersions[pageId] = nextVersions[pageId]; publishedRevisionIds[pageId] = revisionIds[pageId]; });
      publishedPages = promoted; setMessage('ALL 8 PAGES PUBLISHED ATOMICALLY. REVISION HISTORY UPDATED.'); render();
    } catch (error) { console.error(error); setMessage(isConflict(error) ? 'PUBLISH CONFLICT // LIVE CONTENT CHANGED IN ANOTHER TAB OR DEVICE. RELOAD BEFORE PUBLISHING.' : `PUBLISH FAILED // ${errorCode(error)} // LIVE CONTENT WAS NOT CHANGED.`, true); }
    finally { syncControls(); }
  });

  previewButton?.addEventListener('click', () => showPreview('draft'));
  previewClose?.addEventListener('click', () => previewDialog?.close());
  document.querySelectorAll<HTMLButtonElement>('[data-preview-source]').forEach((control) => control.addEventListener('click', () => showPreview(control.dataset.previewSource as 'draft' | 'live')));
  document.querySelectorAll<HTMLButtonElement>('[data-preview-width]').forEach((control) => control.addEventListener('click', () => {
    if (previewStage) previewStage.dataset.width = control.dataset.previewWidth;
    document.querySelectorAll<HTMLButtonElement>('[data-preview-width]').forEach((item) => item.classList.toggle('is-active', item === control));
  }));
  preview.addEventListener('click', async (event) => {
    const control = (event.target as Element).closest<HTMLButtonElement>('[data-action^="revision-"]'); if (!control) return;
    const revision = revisionCache.get(control.dataset.revisionId ?? ''); if (!revision) return;
    if (control.dataset.action === 'revision-view') showPreview(revision.state === 'published' ? 'live' : 'draft', revision.content);
    if (control.dataset.action === 'revision-restore') {
      if (!window.confirm(`Restore revision ${revision.revisionId} as a new ${revision.pageId.toUpperCase()} draft? Live content will not change.`)) return;
      pages[revision.pageId] = pageContent(revision.content) as never; dirtyPages.add(revision.pageId);
      await saveDraft(revision.pageId, `Restored from ${revision.revisionId}`);
      if (!dirtyPages.has(revision.pageId) && services?.auth.currentUser) await recordAudit(services, 'revision.restore', 'page', revision.pageId, `Restored revision ${revision.revisionId} as a new draft`, revision.revisionId);
      selectedPage = revision.pageId; render();
    }
    if (control.dataset.action === 'revision-republish') {
      if (!window.confirm(`Republish revision ${revision.revisionId}? This changes the live ${revision.pageId.toUpperCase()} page but preserves the current draft.`)) return;
      await publishPage(revision.pageId, revision.content, `Republished from ${revision.revisionId}`);
    }
  });

  window.addEventListener('offline', () => setMessage('OFFLINE // CHANGES REMAIN IN THIS TAB UNTIL A SAVE SUCCEEDS.', true));
  window.addEventListener('online', () => { setMessage('CONNECTION RESTORED // RETRYING UNSAVED DRAFTS.'); dirtyPages.forEach((pageId) => { void saveDraft(pageId, 'Autosaved after reconnect'); }); });
  window.addEventListener('beforeunload', (event) => { if (!dirtyPages.size && !savingPages.size) return; event.preventDefault(); event.returnValue = ''; });
  window.addEventListener('keydown', (event) => {
    const modifier = event.metaKey || event.ctrlKey;
    if (modifier && event.key.toLowerCase() === 's') {
      event.preventDefault();
      if (event.shiftKey) saveAllButton?.click(); else saveButton?.click();
      return;
    }
    if (modifier && event.key.toLowerCase() === 'p') { event.preventDefault(); previewButton?.click(); return; }
    if (event.altKey && /^[1-8]$/.test(event.key)) {
      event.preventDefault();
      const pageId = CMS_PAGE_IDS[Number(event.key) - 1];
      document.querySelector<HTMLButtonElement>(`[data-admin-page="${pageId}"]`)?.click();
      return;
    }
    if (event.altKey && event.key.toLowerCase() === 'e') {
      event.preventDefault(); editor.querySelectorAll<HTMLDetailsElement>('details').forEach((item) => { item.open = true; });
    }
    if (event.altKey && event.key.toLowerCase() === 'c') {
      event.preventDefault(); editor.querySelectorAll<HTMLDetailsElement>('details').forEach((item) => { item.open = false; });
    }
  });

  const unlock = async (user: { uid: string; email: string | null } | null, cloud: boolean) => {
    app.classList.add('is-authorized'); if (authPanel) authPanel.hidden = true;
    if (mode) mode.textContent = cloud ? 'FIREBASE // AUTHORIZED' : 'LOCAL // PREVIEW';
    if (identity) identity.textContent = user?.email ?? 'LOCAL DEVELOPER'; if (signOutButton) signOutButton.hidden = !cloud;
    if (cloud) {
      try { if (services) await recordAudit(services, 'admin.session', 'admin', 'content', 'Authenticated content editor session'); } catch (error) { console.error(error); }
      try { await loadCloudPages(); } catch (error) { console.error(error); setMessage('V2 CONTENT LOAD FAILED. STATIC MIGRATION BASELINE IS SHOWN.', true); }
    }
    render();
  };

  if (import.meta.env.DEV && (!firebaseConfigured || !services)) await unlock(null, false);
  else if (!services) { if (authPanel) authPanel.hidden = false; if (mode) mode.textContent = 'FIREBASE // UNAVAILABLE'; setMessage('ADMIN CONFIGURATION UNAVAILABLE.', true); }
  else onAuthStateChanged(services.auth, async (user) => {
    if (user?.emailVerified && user.uid === adminUid) return unlock(user, true);
    app.classList.remove('is-authorized'); if (authPanel) authPanel.hidden = false;
    if (mode) mode.textContent = user ? 'ACCESS // DENIED' : 'AUTH // REQUIRED';
    if (user) { setMessage('THIS GOOGLE ACCOUNT IS NOT AUTHORIZED.', true); await signOut(services.auth); }
  });

  signInButton?.addEventListener('click', async () => {
    if (!services) return; const provider = new GoogleAuthProvider(); provider.setCustomParameters({ login_hint: adminEmail });
    try { await signInWithPopup(services.auth, provider); }
    catch (error) {
      if ((error as { code?: string }).code === 'auth/popup-blocked') await signInWithRedirect(services.auth, provider);
      else { console.error(error); setMessage('GOOGLE SIGN-IN FAILED.', true); }
    }
  });
  signOutButton?.addEventListener('click', () => services && signOut(services.auth));
}
