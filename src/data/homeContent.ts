export interface HomeQueueItem {
  id: 'patient-management' | 'electronic-manuals' | 'recruitment' | 'corporate-web' | 'workforce-portal';
  label: string;
  description: string;
}

export interface HomeContent {
  schemaVersion: 1;
  profile: {
    greeting: string;
    role: string;
    location: string;
    node: string;
    status: string;
    startCopy: string;
    progress: string;
    email: string;
    linkedin: string;
  };
  queue: HomeQueueItem[];
}

export const defaultHomeContent: HomeContent = {
  schemaVersion: 1,
  profile: {
    greeting: 'HELLO, I’M ANIQ',
    role: 'Software Engineer',
    location: 'Sungai Buloh, Selangor, Malaysia',
    node: 'MY-KUL',
    status: 'ONLINE',
    startCopy: 'Browse the system for the full record, or send a direct signal. Every route is live. Nothing goes to junk.',
    progress: 'Brewing software for public healthcare.',
    email: 'aniqsaidi.official@gmail.com',
    linkedin: 'https://www.linkedin.com/in/aniqsaidi/',
  },
  queue: [
    { id: 'patient-management', label: 'PATIENT MGMT', description: 'Connecting patient appointments to hospital care.' },
    { id: 'electronic-manuals', label: 'CENTRAL HIS', description: 'Centralizing patients, doctors, facilities, equipment, and medications.' },
    { id: 'recruitment', label: 'HRMS', description: 'Unifying staff, attendance, payroll, and leave.' },
    { id: 'corporate-web', label: 'CORPORATE WEB', description: 'Building a clearer public digital front door.' },
    { id: 'workforce-portal', label: 'WORKFORCE', description: 'Coordinating recruitment, locums, schedules, reports, and claims.' },
  ],
};

export const HOME_DRAFT_KEY = 'aniq-home-draft-v1';
export const HOME_PUBLISHED_KEY = 'aniq-home-published-v1';

export function normalizeHomeContent(value: unknown): HomeContent {
  if (!value || typeof value !== 'object') return structuredClone(defaultHomeContent);
  const input = value as Partial<HomeContent>;
  const profile = input.profile && typeof input.profile === 'object' ? input.profile : {};
  const text = (candidate: unknown, fallback: string, limit = 240) =>
    typeof candidate === 'string' && candidate.trim()
      ? candidate.trim().slice(0, limit)
      : fallback;

  const queueById = new Map(
    (Array.isArray(input.queue) ? input.queue : [])
      .filter((item): item is HomeQueueItem => Boolean(item && typeof item === 'object' && 'id' in item))
      .map((item) => [item.id, item]),
  );

  return {
    schemaVersion: 1,
    profile: {
      greeting: text(profile.greeting, defaultHomeContent.profile.greeting, 60),
      role: text(profile.role, defaultHomeContent.profile.role, 80),
      location: text(profile.location, defaultHomeContent.profile.location, 100),
      node: text(profile.node, defaultHomeContent.profile.node, 30),
      status: text(profile.status, defaultHomeContent.profile.status, 30),
      startCopy: text(profile.startCopy, defaultHomeContent.profile.startCopy, 320),
      progress: text(profile.progress, defaultHomeContent.profile.progress, 180),
      email: text(profile.email, defaultHomeContent.profile.email, 120),
      linkedin: text(profile.linkedin, defaultHomeContent.profile.linkedin, 200),
    },
    queue: defaultHomeContent.queue.map((fallback) => {
      const item = queueById.get(fallback.id);
      return {
        id: fallback.id,
        label: text(item?.label, fallback.label, 50),
        description: text(item?.description, fallback.description, 180),
      };
    }),
  };
}
