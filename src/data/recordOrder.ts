type OrderableRecord = {
  id?: string;
  sortOrder?: number;
  [key: string]: unknown;
};

const DATE_KEYS = [
  'publicationDate', 'issuedAt', 'startDate', 'endDate', 'date', 'period',
  'description',
] as const;

function dateRank(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return Number.NEGATIVE_INFINITY;
  const text = value.trim();
  const direct = Date.parse(text);
  const years = [...text.matchAll(/(?:19|20)\d{2}/g)].map((match) => Number(match[0]));
  if (years.length > 1) return Date.UTC(Math.max(...years), 11, 31);
  if (Number.isFinite(direct)) return direct;
  return years.length ? Date.UTC(years[0], 11, 31) : Number.NEGATIVE_INFINITY;
}

export function latestRecordRank(record: OrderableRecord) {
  return Math.max(...DATE_KEYS.map((key) => dateRank(record[key])));
}

export function latestFirst<T extends OrderableRecord>(records: readonly T[]) {
  return [...records].sort((a, b) =>
    latestRecordRank(b) - latestRecordRank(a)
    || Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)
    || String(a.id ?? '').localeCompare(String(b.id ?? '')),
  );
}
