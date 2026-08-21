type IndexedRecord = {
  id?: string;
  sortOrder?: number;
  [key: string]: unknown;
};

/** Sort exclusively by the CMS index. Dates and legacy manualOrder values are ignored. */
export function indexFirst<T extends IndexedRecord>(records: readonly T[]) {
  return [...records].sort((a, b) =>
    Number(a.sortOrder ?? Number.MAX_SAFE_INTEGER) - Number(b.sortOrder ?? Number.MAX_SAFE_INTEGER)
    || String(a.id ?? '').localeCompare(String(b.id ?? '')),
  );
}
