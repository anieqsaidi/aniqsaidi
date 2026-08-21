type SortMode = 'latest' | 'oldest' | 'title-asc' | 'title-desc';

const dateRank = (value: string) => {
  const direct = Date.parse(value);
  const years = [...value.matchAll(/(?:19|20)\d{2}/g)].map((match) => Number(match[0]));
  if (years.length > 1) return Date.UTC(Math.max(...years), 11, 31);
  if (Number.isFinite(direct)) return direct;
  return years.length ? Date.UTC(years[0], 11, 31) : Number.NEGATIVE_INFINITY;
};

const compare = (mode: SortMode) => (left: HTMLElement, right: HTMLElement) => {
  const leftTitle = left.dataset.sortTitle ?? '';
  const rightTitle = right.dataset.sortTitle ?? '';
  const titleOrder = leftTitle.localeCompare(rightTitle, undefined, { sensitivity: 'base' });
  const dateOrder = dateRank(right.dataset.sortDate ?? '') - dateRank(left.dataset.sortDate ?? '');
  if (mode === 'oldest') return -dateOrder || titleOrder;
  if (mode === 'title-asc') return titleOrder || dateOrder;
  if (mode === 'title-desc') return -titleOrder || dateOrder;
  return dateOrder || titleOrder;
};

const sortScope = (scope: HTMLElement, mode: SortMode) => {
  scope.querySelectorAll<HTMLElement>('[data-sort-container]').forEach((container) => {
    const records = [...container.children].filter((item): item is HTMLElement =>
      item instanceof HTMLElement && item.hasAttribute('data-sort-item'));
    const sorted = [...records].sort(compare(mode));
    if (sorted.some((record, index) => record !== records[index])) sorted.forEach((record) => container.append(record));
  });
};

let initialized = false;

export function initializeContentSort() {
  if (initialized) return;
  initialized = true;
  document.querySelectorAll<HTMLElement>('[data-sort-control]').forEach((control) => {
    const scopeId = control.dataset.sortControl;
    const scope = scopeId ? document.querySelector<HTMLElement>(`[data-sort-scope="${CSS.escape(scopeId)}"]`) : null;
    const select = control.querySelector<HTMLSelectElement>('select');
    if (!scope || !select) return;
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => { queued = false; sortScope(scope, select.value as SortMode); });
    }).observe(scope, { childList: true, subtree: true });
  });
  document.addEventListener('change', (event) => {
    const select = (event.target as Element).closest<HTMLSelectElement>('[data-sort-control] select');
    if (!select) return;
    const control = select.closest<HTMLElement>('[data-sort-control]');
    const scopeId = control?.dataset.sortControl;
    const scope = scopeId ? document.querySelector<HTMLElement>(`[data-sort-scope="${CSS.escape(scopeId)}"]`) : null;
    if (!control || !scope) return;
    const mode = select.value as SortMode;
    sortScope(scope, mode);
    const label = select.selectedOptions[0]?.textContent ?? 'SORTED';
    const status = control.querySelector<HTMLElement>('[data-sort-status]');
    if (status) status.textContent = label;
  });
}
