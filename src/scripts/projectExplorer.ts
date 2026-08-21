import { type CmsPages, type ProjectRecord } from '../data/cmsSchema';
import { firebaseConfigured, getFirebasePublicServices } from '../lib/firebase';
import { indexFirst } from '../data/recordOrder';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
  const node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node;
};
const active = <T extends { status: string; sortOrder: number }>(items: T[]) => indexFirst(items.filter((item) => item.status !== 'archived'));
const labels = (items: ProjectRecord['technologies']) => active(items).map((item) => item.label).join(' // ');

export async function initializeProjectExplorer() {
  const root = document.querySelector<HTMLElement>('#projects-page');
  const grid = document.querySelector<HTMLElement>('#project-grid');
  if (!root || !grid) return;
  const fallback = JSON.parse(root.dataset.projects ?? '{}') as CmsPages['projects'];
  let projects = active(fallback.data.projects);
  const isDraftPreview = new URLSearchParams(location.search).get('cms-preview') === 'draft';
  if (isDraftPreview) {
    try {
      const payload = JSON.parse(sessionStorage.getItem('aniq-cms-public-preview') ?? '{}') as { projects?: CmsPages['projects'] };
      if (payload.projects) projects = active(payload.projects.data.projects);
    } catch (error) {
      console.warn('Project preview content could not be loaded.', error);
    }
  } else if (firebaseConfigured) {
    try {
      const [services, firestore] = await Promise.all([getFirebasePublicServices(), import('firebase/firestore/lite')]);
      if (services) {
        const snapshot = await firestore.getDoc(firestore.doc(services.db, 'cmsPublished', 'projects'));
        const published = snapshot.data() as CmsPages['projects'] | undefined;
        if (snapshot.exists() && Array.isArray(published?.data?.projects)) {
          const publishedProjects = active(published.data.projects);
          if (!publishedProjects.length) {
            console.warn('Published project content is empty; retaining the built-in project catalogue.');
          } else {
            const publicIdentity = new Map(fallback.data.projects.map((project) => [project.id, project]));
            projects = publishedProjects.map((project, index) => {
              const safe = publicIdentity.get(project.id);
              return {
                ...project,
                slug: safe?.slug ?? `confidential-project-${index + 1}`,
                title: safe?.title ?? 'Confidential Engineering Project',
                organisation: '',
              };
            });
          }
        }
      }
    } catch (error) {
      console.warn('Latest published project content could not be loaded.', error);
    }
  }

  const meta = (label: string, value: string) => { const row = el('div'); row.append(el('dt', '', label), el('dd', '', value || 'NOT DISCLOSED')); return row; };
  const renderGrid = () => {
    grid.replaceChildren();
    if (!projects.length) { grid.append(el('p', 'project-empty', 'NO PUBLISHED PROJECT RECORDS YET. CHECK BACK AFTER THE NEXT DEPLOYMENT.')); return; }
    projects.forEach((project, index) => {
      const card = el('article', 'project-card'); card.id = `project-${project.slug}`; card.dataset.projectCard = project.slug;
      card.dataset.sortItem = ''; card.dataset.sortDate = project.period; card.dataset.sortTitle = project.title;
      const head = el('header');
      const state = el('span', 'project-card-state');
      state.append(el('time', '', project.period), el('strong', '', project.projectStatus));
      const position = el('span', '', String(index + 1).padStart(2, '0')); position.dataset.sortPosition = '';
      const identity = el('span'); identity.append(position, ` // ${project.category}`);
      head.append(identity, state);
      const copy = el('div', 'project-card-copy'); copy.append(el('h2', '', project.title), el('p', '', project.shortDescription));
      const details = el('dl'); details.append(meta('ROLE', project.role), meta('STACK', labels(project.technologies)), meta('PLATFORM', labels(project.platforms)));
      const panelId = `project-case-${project.slug}`;
      const open = el('button', 'project-open', '> OPEN CASE FILE');
      open.type = 'button'; open.dataset.projectOpen = project.slug; open.setAttribute('aria-controls', panelId); open.setAttribute('aria-expanded', 'false');
      const panel = el('section', 'project-case');
      panel.id = panelId; panel.dataset.projectCase = project.slug; panel.setAttribute('aria-live', 'polite'); panel.hidden = true;
      copy.append(details, open); card.append(head, copy, panel); grid.append(card);
    });
  };

  const renderCase = (project: ProjectRecord, caseContent: HTMLElement) => {
    caseContent.replaceChildren();
    const head = el('header', 'project-case-head');
    head.append(el('h2', '', project.title), el('p', '', project.shortDescription));
    const details = el('dl', 'project-case-meta');
    details.append(meta('TYPE', project.category), meta('ROLE', project.role), meta('PERIOD', project.period), meta('STATUS', project.projectStatus), meta('PLATFORMS', labels(project.platforms)), meta('STACK', labels(project.technologies)));
    caseContent.append(head, details);
    if (project.referenceUrl) {
      const reference = el('a', 'project-reference', `${project.referenceLabel || 'VIEW PUBLIC REFERENCE'} ↗`);
      reference.href = project.referenceUrl; reference.target = '_blank'; reference.rel = 'noopener noreferrer';
      caseContent.append(reference);
    }
    const sections = active(project.sections).filter((section) => section.body.trim() || active(section.points).some((point) => point.text.trim()));
    if (sections.length) sections.forEach((section, index) => {
      const block = el('section', 'project-case-section'); block.append(el('span', '', `${String(index + 1).padStart(2, '0')} // ${section.type.toUpperCase()}`), el('h3', '', section.heading));
      if (section.body) block.append(el('p', '', section.body));
      const points = active(section.points).filter((point) => point.text.trim());
      if (points.length) { const list = el('ul'); points.forEach((point) => list.append(el('li', '', point.text))); block.append(list); }
      caseContent.append(block);
    });
    else caseContent.append(el('p', 'project-case-pending', '[ DETAILED ENGINEERING NOTES ARE BEING REVIEWED FOR SAFE PUBLIC RELEASE. ]'));
    if (project.confidentialityNote) { const note = el('aside', 'project-confidentiality'); note.append(el('strong', '', 'CONFIDENTIALITY // '), document.createTextNode(project.confidentialityNote)); caseContent.append(note); }
  };

  renderGrid();

  const closeCases = () => {
    grid.querySelectorAll<HTMLElement>('[data-project-card]').forEach((card) => { card.classList.remove('is-open'); });
    grid.querySelectorAll<HTMLButtonElement>('[data-project-open]').forEach((button) => {
      button.setAttribute('aria-expanded', 'false');
      button.textContent = '> OPEN CASE FILE';
    });
    grid.querySelectorAll<HTMLElement>('[data-project-case]').forEach((panel) => { panel.hidden = true; });
  };

  const showCase = (slug: string, updateUrl = true) => {
    const project = projects.find((item) => item.slug === slug);
    const button = grid.querySelector<HTMLButtonElement>(`[data-project-open="${CSS.escape(slug)}"]`);
    const panel = grid.querySelector<HTMLElement>(`[data-project-case="${CSS.escape(slug)}"]`);
    const card = grid.querySelector<HTMLElement>(`[data-project-card="${CSS.escape(slug)}"]`);
    if (!project || !button || !panel || !card) return;

    closeCases();
    renderCase(project, panel);
    card.classList.add('is-open');
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    button.textContent = '× CLOSE CASE FILE';
    if (updateUrl) history.replaceState(null, '', `/projects/?project=${encodeURIComponent(project.slug)}#project-${project.slug}`);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        card.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      });
    });
  };

  grid.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-project-open]');
    if (!button) return;
    const wasOpen = button.getAttribute('aria-expanded') === 'true';
    const slug = button.dataset.projectOpen ?? '';
    closeCases();
    if (wasOpen) {
      history.replaceState(null, '', '/projects/');
      return;
    }
    showCase(slug);
  });

  const requested = new URLSearchParams(location.search).get('project'); if (requested) showCase(requested, false);
}
