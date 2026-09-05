import { GoogleAuthProvider, getRedirectResult, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
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
import { indexFirst } from '../data/recordOrder';
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

type InputType = 'text' | 'textarea' | 'email' | 'url' | 'month' | 'date' | 'number' | 'checkbox' | 'select';
type NestedType = 'textRecords' | 'tagRecords' | 'sections';
type FieldConfig = { key: string; label: string; type?: InputType; options?: string[]; nested?: NestedType };
type CollectionConfig = { key: string; title: string; labelKey: string; ordering?: 'indexed' | 'manual'; fields: FieldConfig[] };
type PageConfig = { single?: FieldConfig[]; collections: CollectionConfig[] };

const configs: Record<CmsPageId, PageConfig> = {
  home: {
    single: [
      { key: 'profile.greeting', label: 'Greeting' }, { key: 'profile.role', label: 'Role' },
      { key: 'profile.location', label: 'Location' }, { key: 'profile.email', label: 'Email', type: 'email' },
      { key: 'profile.node', label: 'Node' }, { key: 'profile.status', label: 'Status' },
      { key: 'profile.startCopy', label: 'Start copy', type: 'textarea' },
      { key: 'profile.progress', label: 'Current progress', type: 'textarea' },
      { key: 'profile.linkedin', label: 'Linkedin', type: 'url' },
    ],
    collections: [
      { key: 'queue', title: 'Active queue', labelKey: 'label', fields: [{ key: 'label', label: 'Label' }, { key: 'description', label: 'Description', type: 'textarea' }] },
      { key: 'callsToAction', title: 'Calls to action', labelKey: 'label', fields: [{ key: 'label', label: 'Label' }, { key: 'url', label: 'Url', type: 'url' }, { key: 'external', label: 'External link', type: 'checkbox' }] },
    ],
  },
  about: {
    single: [
      { key: 'name', label: 'Name' }, { key: 'role', label: 'Role' }, { key: 'location', label: 'Location' },
      { key: 'email', label: 'Email', type: 'email' }, { key: 'linkedin', label: 'Linkedin', type: 'url' },
    ],
    collections: [
      { key: 'education', title: 'Education records', labelKey: 'qualification', fields: [
        { key: 'qualification', label: 'Qualification' }, { key: 'institution', label: 'Institution' },
        { key: 'period', label: 'Period' }, { key: 'earlierRecord', label: 'Earlier record', type: 'checkbox' },
      ] },
    ],
  },
  projects: {
    collections: [
      { key: 'projects', title: 'Projects & case studies', labelKey: 'title', ordering: 'indexed', fields: [
        { key: 'title', label: 'Project title' }, { key: 'slug', label: 'Slug' },
        { key: 'shortDescription', label: 'Short description', type: 'textarea' }, { key: 'category', label: 'Category' },
        { key: 'role', label: 'My role' }, { key: 'organisation', label: 'Organisation' },
        { key: 'period', label: 'Period' }, { key: 'projectStatus', label: 'Project status' },
        { key: 'featured', label: 'Featured', type: 'checkbox' }, { key: 'thumbnail', label: 'Thumbnail path' },
        { key: 'platforms', label: 'Platforms', nested: 'tagRecords' },
        { key: 'technologies', label: 'Technologies', nested: 'tagRecords' },
        { key: 'referenceLabel', label: 'Reference label' }, { key: 'referenceUrl', label: 'Reference URL', type: 'url' },
        { key: 'confidentialityNote', label: 'Confidentiality note', type: 'textarea' },
        { key: 'sections', label: 'Case-study sections', nested: 'sections' },
      ] },
    ],
  },
  experience: {
    collections: [
      { key: 'jobs', title: 'Experience records', labelKey: 'role', ordering: 'indexed', fields: [
        { key: 'role', label: 'Role' }, { key: 'company', label: 'Company' }, { key: 'location', label: 'Location' },
        { key: 'period', label: 'Display period' }, { key: 'startDate', label: 'Start', type: 'month' },
        { key: 'endDate', label: 'End', type: 'month' }, { key: 'current', label: 'Current role', type: 'checkbox' },
        { key: 'featured', label: 'Featured', type: 'checkbox' }, { key: 'highlights', label: 'Outcome points', nested: 'textRecords' },
        { key: 'technologies', label: 'Technologies', nested: 'tagRecords' },
      ] },
      { key: 'toolkit', title: 'Toolkit groups', labelKey: 'group', fields: [
        { key: 'group', label: 'Group' }, { key: 'technologies', label: 'Skills & technologies', nested: 'tagRecords' },
      ] },
    ],
  },
  certifications: { collections: [{ key: 'certifications', title: 'Certification records', labelKey: 'title', ordering: 'indexed', fields: [
    { key: 'title', label: 'Title' }, { key: 'issuer', label: 'Issuer' }, { key: 'issuedAt', label: 'Issued' },
    { key: 'category', label: 'Category', type: 'select', options: ['professional', 'cloud', 'learning'] },
    { key: 'credentialUrl', label: 'Credential URL', type: 'url' }, { key: 'featured', label: 'Featured', type: 'checkbox' },
  ] }] },
  awards: { collections: [{ key: 'awards', title: 'Award records', labelKey: 'title', ordering: 'indexed', fields: [
    { key: 'title', label: 'Title' }, { key: 'issuer', label: 'Issuer' }, { key: 'date', label: 'Date' },
    { key: 'description', label: 'Description', type: 'textarea' }, { key: 'category', label: 'Category' },
    { key: 'featured', label: 'Featured', type: 'checkbox' },
  ] }] },
  leadership: { collections: [{ key: 'leadership', title: 'Leadership records', labelKey: 'role', ordering: 'indexed', fields: [
    { key: 'role', label: 'Role' }, { key: 'organisation', label: 'Organisation' }, { key: 'period', label: 'Period' },
    { key: 'description', label: 'Description', type: 'textarea' }, { key: 'scope', label: 'Scope' },
    { key: 'earlierRecord', label: 'Earlier record', type: 'checkbox' }, { key: 'featured', label: 'Featured', type: 'checkbox' },
  ] }] },
  archives: {
    single: [{ key: 'lede', label: 'Archive introduction', type: 'textarea' }],
    collections: [{ key: 'articles', title: 'Archive articles', labelKey: 'title', ordering: 'indexed', fields: [
      { key: 'title', label: 'Title' }, { key: 'slug', label: 'Slug' }, { key: 'publication', label: 'Publication' },
      { key: 'publicationDate', label: 'Publication date', type: 'date' }, { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'sourceUrl', label: 'Source URL', type: 'url' }, { key: 'assetPath', label: 'Asset path' },
      { key: 'language', label: 'Language' }, { key: 'featured', label: 'Featured', type: 'checkbox' },
    ] }],
  },
};

const templates: Record<string, () => Record<string, unknown>> = {
  queue: () => ({ id: createRecordId('queue'), label: 'New item', description: '', sortOrder: 0, status: 'draft' }),
  callsToAction: () => ({ id: createRecordId('cta'), label: 'New action', url: '/', external: false, sortOrder: 0, status: 'draft' }),
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
      const item = document.createElement('option'); item.value = option; item.textContent = option.charAt(0).toUpperCase() + option.slice(1); item.selected = value === option; control.append(item);
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
  const authMessage = document.querySelector<HTMLElement>('#admin-auth-message');
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
    if (message) { message.textContent = text; message.classList.toggle('is-error', error); }
    if (authMessage) { authMessage.textContent = text; authMessage.classList.toggle('is-error', error); }
  };

  const syncControls = () => {
    const unresolved = savingPages.size > 0;
    if (saveButton) saveButton.disabled = unresolved;
    if (saveAllButton) saveAllButton.disabled = unresolved;
    if (publishPageButton) publishPageButton.disabled = unresolved;
    if (publishButton) publishButton.disabled = unresolved;
    if (pageState) {
      const state = savingPages.has(selectedPage) ? 'Saving…'
        : dirtyPages.has(selectedPage) ? 'Autosave pending'
          : !pagesMatch(pages[selectedPage], publishedPages[selectedPage]) ? 'Draft saved'
            : migrationPending ? 'Migration ready' : 'Up to date';
      pageState.textContent = state;
      pageState.dataset.state = dirtyPages.has(selectedPage) ? 'dirty' : 'saved';
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
          fieldControl({ key: 'type', label: 'Type', type: 'select', options: ['problem','role','constraints','solution','architecture','challenges','outcomes','reflection'] }, `${path}.${index}.type`, record.type),
          fieldControl({ key: 'heading', label: 'Heading' }, `${path}.${index}.heading`, record.heading),
          fieldControl({ key: 'body', label: 'Body', type: 'textarea' }, `${path}.${index}.body`, record.body),
        );
        const points = renderNested('textRecords', (record.points as Array<Record<string, unknown>>) ?? [], `${path}.${index}.points`);
        sectionGrid.append(points); row.append(sectionGrid);
      } else {
        row.append(fieldControl({ key: type === 'tagRecords' ? 'label' : 'text', label: type === 'tagRecords' ? 'TAG' : 'POINT' }, `${path}.${index}.${type === 'tagRecords' ? 'label' : 'text'}`, record[type === 'tagRecords' ? 'label' : 'text']));
      }
      wrap.append(row);
    });
    const add = button(type === 'sections' ? '+ Add section' : type === 'tagRecords' ? '+ Add tag' : '+ Add point', 'nested-add');
    add.dataset.path = path; add.dataset.nestedType = type; wrap.append(add); return wrap;
  };

  const renderCollection = (config: CollectionConfig, recordsInput: Array<Record<string, unknown>>) => {
    const section = document.createElement('section'); section.className = 'admin-collection';
    const header = document.createElement('header');
    const headingWrap = document.createElement('div'); headingWrap.className = 'admin-collection-heading';
    const heading = document.createElement('h3'); heading.textContent = `${config.title} (${recordsInput.length})`;
    headingWrap.append(heading);
    if (config.ordering === 'indexed') {
      const ordering = document.createElement('small'); ordering.className = 'admin-ordering-note';
      ordering.textContent = 'Display order · 1 appears first';
      headingWrap.append(ordering);
    }
    const add = button('+ Add record', 'add'); add.dataset.collection = config.key; header.append(headingWrap, add); section.append(header);
    const records = config.ordering === 'indexed' ? indexFirst(recordsInput) : recordsInput;
    records.forEach((record, displayedIndex) => {
      const actualIndex = recordsInput.indexOf(record);
      const details = document.createElement('details'); details.className = 'admin-record'; details.open = displayedIndex === 0;
      const summary = document.createElement('summary');
      const label = String(record[config.labelKey] || 'UNTITLED RECORD');
      summary.textContent = `${displayedIndex + 1}. ${label}`;
      const badge = document.createElement('span'); badge.textContent = String(record.status ?? 'draft'); summary.append(badge); details.append(summary);
      const body = document.createElement('div'); body.className = 'admin-record-body';
      const metadata = document.createElement('div'); metadata.className = 'admin-record-meta';
      metadata.append(fieldControl({ key: 'id', label: 'Stable ID' }, `data.${config.key}.${actualIndex}.id`, record.id));
      const idInput = metadata.querySelector<HTMLInputElement>('input'); if (idInput) idInput.readOnly = true;
      metadata.append(fieldControl({ key: 'status', label: 'Status', type: 'select', options: ['draft','published','archived'] }, `data.${config.key}.${actualIndex}.status`, record.status));
      if (config.ordering === 'indexed') {
        const orderField = fieldControl({ key: 'sortOrder', label: 'Display order (1 appears first)', type: 'number' }, '', displayedIndex + 1);
        const orderInput = orderField.querySelector<HTMLInputElement>('input');
        if (orderInput) {
          orderInput.removeAttribute('data-path'); orderInput.min = '1'; orderInput.max = String(records.length);
          orderInput.step = '1'; orderInput.dataset.orderIndex = ''; orderInput.dataset.collection = config.key;
          orderInput.dataset.recordId = String(record.id ?? '');
        }
        metadata.append(orderField);
      }
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
      const availableActions = [
        ['↑ MOVE UP','up'],['↓ MOVE DOWN','down'],
        ['⧉ DUPLICATE','duplicate'],
        [record.status === 'archived' ? '↺ RESTORE' : '□ ARCHIVE','archive'],
        ['× DELETE','delete'],
      ];
      availableActions.forEach(([labelText, action]) => {
        const control = button(labelText, action); control.dataset.collection = config.key; control.dataset.index = String(actualIndex); control.dataset.recordId = String(record.id ?? '');
        if (action === 'up') control.disabled = displayedIndex === 0;
        if (action === 'down') control.disabled = displayedIndex === records.length - 1;
        actions.append(control);
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
    statusLine.textContent = issues.length ? `${issues.length} validation issue${issues.length === 1 ? '' : 's'}` : 'Ready to publish'; preview.append(statusLine);
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
      copy.textContent = `${active} active · ${drafts} drafts · ${records.length - active} archived`; line.append(heading, copy); preview.append(line);
    });
    const live = document.createElement('article');
    const liveHeading = document.createElement('strong'); liveHeading.textContent = 'Publication';
    const liveCopy = document.createElement('p');
    liveCopy.textContent = pagesMatch(page, publishedPages[selectedPage]) ? 'Up to date' : 'Unpublished changes';
    live.append(liveHeading, liveCopy); preview.append(live);
    const revisions = document.createElement('section'); revisions.className = 'admin-revisions'; revisions.dataset.revisionsFor = selectedPage;
    const revisionsHeading = document.createElement('strong'); revisionsHeading.textContent = 'Version history';
    const loading = document.createElement('small'); loading.textContent = 'Loading…'; revisions.append(revisionsHeading, loading); preview.append(revisions);
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
    pageTitle.textContent = page.title.charAt(0).toUpperCase() + page.title.slice(1).toLowerCase(); editor.replaceChildren();
    if (config.single?.length) {
      const section = document.createElement('section'); section.className = 'admin-single-fields';
      const heading = document.createElement('h3'); heading.textContent = 'Page details'; section.append(heading);
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
  const reindex = (records: Array<Record<string, unknown>>) => records.forEach((record, index) => {
    record.sortOrder = index;
    delete record.manualOrder;
  });

  editor.addEventListener('change', (event) => {
    const control = (event.target as Element).closest<HTMLInputElement>('[data-order-index]');
    if (!control) return;
    const records = collection(control.dataset.collection!);
    const displayed = indexFirst(records);
    const currentIndex = displayed.findIndex((record) => record.id === control.dataset.recordId);
    const requestedIndex = Math.min(records.length - 1, Math.max(0, Number(control.value) - 1));
    if (currentIndex < 0 || !Number.isInteger(requestedIndex)) return;
    const [record] = displayed.splice(currentIndex, 1);
    displayed.splice(requestedIndex, 0, record);
    records.splice(0, records.length, ...displayed);
    reindex(records);
    setDirty(); render();
  });

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
    const config = configs[selectedPage].collections.find((item) => item.key === key);
    if (action === 'add') {
      const added = { ...templates[key](), sortOrder: records.length } as Record<string, unknown>;
      records.push(added);
    }
    else {
      const index = records.findIndex((item) => item.id === control.dataset.recordId);
      const record = records[index]; if (!record) return;
      if ((action === 'up' || action === 'down') && config?.ordering === 'indexed') {
        const displayed = indexFirst(records);
        const displayedIndex = displayed.indexOf(record);
        const target = action === 'up' ? displayedIndex - 1 : displayedIndex + 1;
        if (target >= 0 && target < displayed.length) {
          [displayed[displayedIndex], displayed[target]] = [displayed[target], displayed[displayedIndex]];
          records.splice(0, records.length, ...displayed);
        }
      } else if (action === 'up' && index > 0) [records[index - 1], records[index]] = [records[index], records[index - 1]];
      else if (action === 'down' && index < records.length - 1) [records[index + 1], records[index]] = [records[index], records[index + 1]];
      if (action === 'duplicate') {
        const duplicate = reidentify(record, key) as Record<string, unknown>;
        if (config?.ordering === 'indexed') {
          const displayed = indexFirst(records);
          displayed.splice(displayed.indexOf(record) + 1, 0, duplicate);
          records.splice(0, records.length, ...displayed);
        } else {
          records.splice(index + 1, 0, duplicate);
        }
      }
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
        copy.textContent = `${revision.summary} · Draft ${pagesMatch(revision.content, pages[pageId]) ? 'matches' : 'differs'} · Published ${pagesMatch(revision.content, publishedPages[pageId]) ? 'matches' : 'differs'}`;
        const actions = document.createElement('div');
        [['VIEW','revision-view'],['RESTORE AS DRAFT','revision-restore'],['Republish','revision-republish']].forEach(([label, action]) => {
          const control = button(label, action); control.dataset.revisionId = revision.revisionId; actions.append(control);
        });
        row.append(title, copy, actions); target.append(row);
      });
    } catch (error) { console.error(error); const status = target.querySelector('small'); if (status) status.textContent = `Version history unavailable: ${errorCode(error)}`; }
  };

  const saveDraft = (pageId: CmsPageId, summary = 'Draft saved'): Promise<void> => {
    if (savingPages.has(pageId)) {
      saveAgain.add(pageId);
      return savePromises.get(pageId) ?? Promise.resolve();
    }
    const timer = saveTimers.get(pageId); if (timer) window.clearTimeout(timer); saveTimers.delete(pageId);
    if (!services?.auth.currentUser) {
      setMessage('Offline · draft not saved. authentication required.', true); syncControls(); return Promise.resolve();
    }
    const snapshot = pageContent(pages[pageId]);
    const revisionId = createRevisionId(pageId, 'draft');
    const nextVersion = draftVersions[pageId] + 1;
    dirtyPages.delete(pageId); savingPages.add(pageId); syncControls(); setMessage(`Saving ${snapshot.title} draft…`);
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
        setMessage(`${snapshot.title} · Draft saved ${new Intl.DateTimeFormat('en-MY', { timeStyle: 'medium', timeZone: 'Asia/Kuala_Lumpur' }).format(new Date())} MYT`);
      } catch (error) {
        failed = true; conflicted = isConflict(error); console.error(error); dirtyPages.add(pageId);
        setMessage(isConflict(error) ? `Save conflict: ${pageId} changed in another tab or device. Reload before saving.` : `Save failed: ${errorCode(error)}. Your draft is still in this tab.`, true);
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
    if (!services?.auth.currentUser) return setMessage('Publish blocked: authentication required.', true);
    if (source === pages[pageId] && (dirtyPages.has(pageId) || savingPages.has(pageId))) await saveDraft(pageId, 'Draft saved before publishing');
    if (source === pages[pageId] && dirtyPages.has(pageId)) return setMessage('Publish blocked: draft save has not succeeded.', true);
    const promoted = preparePublishedPage(source) as CmsPages[typeof pageId];
    const issues = validateCmsPage(promoted);
    if (issues.length) { setMessage(`Cannot publish: ${issues[0].path} — ${issues[0].message}`, true); renderPreview(); return; }
    const summary = pageChangeSummary(source, publishedPages[pageId]);
    const revisionId = createRevisionId(pageId, 'published');
    const nextVersion = publishedVersions[pageId] + 1;
    const actor = services.auth.currentUser.uid;
    if (publishPageButton) publishPageButton.disabled = true; if (publishButton) publishButton.disabled = true;
    setMessage(`Publishing ${source.title}…`);
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
      setMessage(`${source.title} published. Your live site has been updated.`); render();
    } catch (error) { console.error(error); setMessage(isConflict(error) ? `Publish conflict: ${pageId} changed in another tab or device. Reload before publishing.` : `Publish failed: ${errorCode(error)}. Live content was not changed.`, true); }
    finally { syncControls(); }
  };

  const appendPreviewValue = (parent: HTMLElement, key: string, value: unknown) => {
    if (value === '' || value == null || ['id','sortOrder','manualOrder','status','featured','external','earlierRecord'].includes(key)) return;
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
    if (previewTitle) previewTitle.textContent = `${override ? 'Version' : source.toUpperCase()} preview · ${page.title}`;
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
    if (!services?.auth.currentUser) return setMessage('Save all blocked: authentication required.', true);
    await Promise.all(CMS_PAGE_IDS.map((pageId) => saveDraft(pageId, 'Manual save all')));
    setMessage('All 8 page drafts saved. live content was not changed.');
  });

  publishPageButton?.addEventListener('click', async () => {
    const summary = pageChangeSummary(pages[selectedPage], publishedPages[selectedPage]);
    if (!window.confirm(`PUBLISH ${pages[selectedPage].title}?\n\n${summary}\n\nOnly records marked PUBLISHED will become public.`)) return;
    await publishPage(selectedPage);
  });

  publishButton?.addEventListener('click', async () => {
    if (!services?.auth.currentUser) return setMessage('Publish blocked: authentication required.', true);
    const changed = changedPageIds(pages, publishedPages);
    const summary = changed.length ? changed.map((pageId) => `- ${pageChangeSummary(pages[pageId], publishedPages[pageId])}`).join('\n') : '- No detected changes; a new published revision will still be recorded.';
    if (!window.confirm(`PUBLISH ALL 8 PAGES ATOMICALLY?\n\n${summary}\n\nOnly records marked PUBLISHED will become public.`)) return;
    await Promise.all(CMS_PAGE_IDS.filter((pageId) => dirtyPages.has(pageId) || savingPages.has(pageId)).map((pageId) => saveDraft(pageId, 'Draft saved before bulk publish')));
    if (dirtyPages.size) return setMessage('Publish all blocked: one or more draft saves have not succeeded.', true);
    const promoted = Object.fromEntries(CMS_PAGE_IDS.map((pageId) => [pageId, preparePublishedPage(pages[pageId])])) as unknown as CmsPages;
    const issues = validateCmsPages(promoted);
    if (issues.length) return setMessage(`Cannot publish all pages: ${issues[0].path} — ${issues[0].message}`, true);
    publishButton.disabled = true; if (publishPageButton) publishPageButton.disabled = true; setMessage('Publishing all 8 pages in one atomic batch…');
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
      publishedPages = promoted; setMessage('All 8 pages published atomically. revision history updated.'); render();
    } catch (error) { console.error(error); setMessage(isConflict(error) ? 'The published content changed in another tab or device. Reload before publishing.' : `Publish failed: ${errorCode(error)}. Live content was not changed.`, true); }
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

  window.addEventListener('offline', () => setMessage('Offline · changes remain in this tab until a save succeeds.', true));
  window.addEventListener('online', () => { setMessage('Connection restored · retrying unsaved drafts.'); dirtyPages.forEach((pageId) => { void saveDraft(pageId, 'Autosaved after reconnect'); }); });
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
    if (mode) mode.textContent = cloud ? 'Connected' : 'Local preview';
    if (identity) identity.textContent = user?.email ?? 'Local developer'; if (signOutButton) signOutButton.hidden = !cloud;
    if (cloud) {
      try { if (services) await recordAudit(services, 'admin.session', 'admin', 'content', 'Authenticated content editor session'); } catch (error) { console.error(error); }
      try { await loadCloudPages(); } catch (error) { console.error(error); setMessage('V2 content load failed. static migration baseline is shown.', true); }
    }
    render();
  };

  if (import.meta.env.DEV && (!firebaseConfigured || !services)) await unlock(null, false);
  else if (!services) { if (authPanel) authPanel.hidden = false; if (mode) mode.textContent = 'Connection unavailable'; setMessage('Admin configuration unavailable.', true); }
  else onAuthStateChanged(services.auth, async (user) => {
    if (user?.emailVerified && user.uid === adminUid) return unlock(user, true);
    app.classList.remove('is-authorized'); if (authPanel) authPanel.hidden = false;
    if (mode) mode.textContent = user ? 'Access denied' : 'Sign-in required';
    if (user) { setMessage('This Google account is not authorized · use the approved admin account.', true); await signOut(services.auth); }
    else setMessage('Sign in to continue.');
  });

  if (services) void getRedirectResult(services.auth).catch((error) => {
    console.error(error); setMessage(`Google sign-in failed: ${errorCode(error)}.`, true);
  });

  signInButton?.addEventListener('click', async () => {
    if (!services) return; const provider = new GoogleAuthProvider(); provider.setCustomParameters({ login_hint: adminEmail });
    try { await signInWithPopup(services.auth, provider); }
    catch (error) {
      const code = (error as { code?: string }).code ?? '';
      if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(code)) {
        setMessage('The sign-in popup is unavailable. Continuing in this window…');
        await signInWithRedirect(services.auth, provider);
      } else { console.error(error); setMessage(`Google sign-in failed: ${errorCode(error)}.`, true); }
    }
  });
  signOutButton?.addEventListener('click', () => services && signOut(services.auth));
}
