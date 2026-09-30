export type Region = 'peninsular' | 'east-malaysia';
export const SERVICE_SOURCE = 'https://www.perodua.com.my/after-sales/service-maintenance';
export const SERVICE_PROFILE = 'perodua-myvi-1500-auto';
export const SERVICE_ITEMS = [
  { id: 'engine-oil', name: 'Perodua Engine Oil Fully Syn 0W-20 3.5L', quantity: 1, category: 'parts', peninsular: 161.10, east: 167.80 },
  { id: 'engine-gasket', name: 'Drain Plug Gasket - Engine Oil', quantity: 1, category: 'parts', peninsular: 3.80, east: 4.20 },
  { id: 'oil-filter', name: 'Engine Oil Filter', quantity: 1, category: 'parts', peninsular: 12.50, east: 13.25 },
  { id: 'air-filter', name: 'Air Cleaner Filter', quantity: 1, category: 'parts', peninsular: 62.90, east: 69.20 },
  { id: 'atf', name: 'Auto Transmission Oil ATF D3 SP', quantity: 3, category: 'parts', peninsular: 138.30, east: 146.70 },
  { id: 'at-gasket', name: 'Drain Plug Gasket - AT', quantity: 1, category: 'parts', peninsular: 3.80, east: 4.20 },
  { id: 'brake-fluid', name: 'Brake Fluid 1.0L', quantity: 1, category: 'parts', peninsular: 26.40, east: 27.70 },
  { id: 'labour', name: 'Labour Charges', quantity: 1, category: 'labour', peninsular: 165.00, east: 165.00 },
  { id: 'sst', name: 'SST (8%)', quantity: 1, category: 'tax', peninsular: 13.20, east: 13.20 },
] as const;

export const SERVICE_SCHEDULE = [40000, 80000].map((targetMileage) => ({
  id: `perodua-myvi1500-auto-${targetMileage}`,
  profileId: SERVICE_PROFILE,
  transmission: 'automatic',
  targetMileage,
  itemGroupId: '40000-80000',
  intervalMonths: null as number | null,
  sourceUrl: SERVICE_SOURCE,
  verifiedAt: null as string | null,
}));

export const PRICE_SNAPSHOT = {
  source: 'Owner supplied screenshot of Perodua selector: MYVI 1500cc, 40,000KM & 80,000KM, Automatic Transmission',
  checkedAt: null as string | null,
  totals: { peninsular: 587.00, 'east-malaysia': 611.25 },
};

export function priceFor(item: typeof SERVICE_ITEMS[number], region: Region) {
  return region === 'peninsular' ? item.peninsular : item.east;
}

export function dueState(targetMileage: number, currentMileage: number, completed: boolean, dueDate?: Date | null, now = new Date()) {
  if (completed) return 'completed';
  const remaining = targetMileage - currentMileage;
  const days = dueDate ? Math.ceil((dueDate.getTime() - now.getTime()) / 86400000) : Infinity;
  if (remaining <= 0 || days <= 0) return 'due';
  if (remaining <= 1000 || days <= 30) return 'soon';
  return 'upcoming';
}

export function nextService(currentMileage: number, completedIds: string[]) {
  const completed = new Set(completedIds);
  return SERVICE_SCHEDULE.find((entry) => !completed.has(entry.id)) ?? null;
}
