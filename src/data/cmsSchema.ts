import type { HomeContent } from './homeContent';

export const CMS_SCHEMA_VERSION = 2 as const;

export const CMS_PAGE_IDS = [
  'home',
  'about',
  'projects',
  'experience',
  'certifications',
  'awards',
  'leadership',
  'archives',
] as const;

export type CmsPageId = typeof CMS_PAGE_IDS[number];
export type RecordStatus = 'draft' | 'published' | 'archived';

export interface CmsRecord {
  id: string;
  sortOrder: number;
  status: RecordStatus;
}

export interface TextRecord extends CmsRecord {
  text: string;
}

export interface TagRecord extends CmsRecord {
  label: string;
}

export interface HomeQueueRecord extends CmsRecord {
  label: string;
  description: string;
}

export interface CtaRecord extends CmsRecord {
  label: string;
  url: string;
  external: boolean;
}

export interface EducationRecord extends CmsRecord {
  qualification: string;
  institution: string;
  period: string;
  earlierRecord: boolean;
}

export interface ExperienceRecord extends CmsRecord {
  role: string;
  company: string;
  location: string;
  period: string;
  startDate: string;
  endDate: string;
  current: boolean;
  featured: boolean;
  highlights: TextRecord[];
  technologies: TagRecord[];
}

export interface ToolkitRecord extends CmsRecord {
  group: string;
  technologies: TagRecord[];
}

export interface CertificationRecord extends CmsRecord {
  title: string;
  issuer: string;
  issuedAt: string;
  category: 'professional' | 'cloud' | 'learning';
  credentialUrl: string;
  featured: boolean;
}

export interface AwardRecord extends CmsRecord {
  title: string;
  issuer: string;
  date: string;
  description: string;
  category: string;
  featured: boolean;
}

export interface LeadershipRecord extends CmsRecord {
  role: string;
  organisation: string;
  period: string;
  description: string;
  scope: string;
  earlierRecord: boolean;
  featured: boolean;
}

export interface ArchiveRecord extends CmsRecord {
  slug: string;
  title: string;
  publication: string;
  publicationDate: string;
  description: string;
  sourceUrl: string;
  assetPath: string;
  language: string;
  featured: boolean;
}

export type CaseStudySectionType = 'problem' | 'role' | 'constraints' | 'solution' | 'architecture' | 'challenges' | 'outcomes' | 'reflection';

export interface CaseStudySection extends CmsRecord {
  type: CaseStudySectionType;
  heading: string;
  body: string;
  points: TextRecord[];
}

export interface ProjectRecord extends CmsRecord {
  slug: string;
  title: string;
  shortDescription: string;
  category: string;
  role: string;
  organisation: string;
  period: string;
  projectStatus: string;
  featured: boolean;
  thumbnail: string;
  platforms: TagRecord[];
  technologies: TagRecord[];
  referenceLabel: string;
  referenceUrl: string;
  confidentialityNote: string;
  sections: CaseStudySection[];
}

export interface CmsPage<TData = Record<string, unknown>> {
  schemaVersion: typeof CMS_SCHEMA_VERSION;
  pageId: CmsPageId;
  title: string;
  data: TData;
}

export interface CmsPages {
  home: CmsPage<{
    profile: HomeContent['profile'];
    queue: HomeQueueRecord[];
    callsToAction: CtaRecord[];
  }>;
  about: CmsPage<{
    name: string;
    role: string;
    location: string;
    email: string;
    linkedin: string;
    education: EducationRecord[];
  }>;
  projects: CmsPage<{ projects: ProjectRecord[] }>;
  experience: CmsPage<{ jobs: ExperienceRecord[]; toolkit: ToolkitRecord[] }>;
  certifications: CmsPage<{ certifications: CertificationRecord[] }>;
  awards: CmsPage<{ awards: AwardRecord[] }>;
  leadership: CmsPage<{ leadership: LeadershipRecord[] }>;
  archives: CmsPage<{ lede: string; articles: ArchiveRecord[] }>;
}

export interface ValidationIssue {
  path: string;
  message: string;
}

const clone = <T>(value: T): T => structuredClone(value);
const text = (value: unknown, fallback = '', limit = 2000) =>
  typeof value === 'string' ? value.trim().slice(0, limit) : fallback;
const bool = (value: unknown, fallback = false) => typeof value === 'boolean' ? value : fallback;
const order = (value: unknown, fallback: number) => Number.isInteger(value) && Number(value) >= 0 ? Number(value) : fallback;
const status = (value: unknown): RecordStatus => value === 'archived' || value === 'published' ? value : 'draft';

export function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64) || 'record';
}

function hash(value: string) {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

export function stableId(prefix: string, seed: string) {
  return `${slugify(prefix)}-${hash(seed)}`;
}

export function createRecordId(prefix: string) {
  const uuid = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${slugify(prefix)}-${uuid}`;
}

const splitTags = (value: unknown, seed: string): TagRecord[] =>
  text(value)
    .split(/\s*\/\/\s*|\s*,\s*/)
    .map((label) => label.trim())
    .filter(Boolean)
    .map((label, index) => ({
      id: stableId('tag', `${seed}:${label}:${index}`),
      label,
      sortOrder: index,
      status: 'published',
    }));

const grouped = (fields: Record<string, string>, expression: RegExp) => {
  const records = new Map<number, Record<string, string>>();
  for (const [key, value] of Object.entries(fields)) {
    const match = key.match(expression);
    if (!match) continue;
    const index = Number(match[1]);
    const property = match[2];
    records.set(index, { ...records.get(index), [property]: value });
  }
  return [...records.entries()].sort(([a], [b]) => a - b);
};

const projectSection = (projectSlug: string, type: CaseStudySectionType, heading: string, sortOrder: number, body = '', points: string[] = []): CaseStudySection => ({
  id: stableId('section', `${projectSlug}:${type}`),
  type,
  heading,
  body,
  points: points.map((text, index) => ({ id: stableId('point', `${projectSlug}:${type}:${text}`), text, sortOrder: index, status: 'published' })),
  sortOrder,
  status: 'published',
});

export const defaultProjects: ProjectRecord[] = [
  {
    id: 'project-patient-management-platform',
    slug: 'patient-management-platform',
    title: 'Patient Management Platform',
    shortDescription: 'A mobile-first patient management platform connecting healthcare workflows across web, Android, and iOS.',
    category: 'Patient Management Platform',
    role: 'Software Engineer',
    organisation: '',
    period: '2026 - Present',
    projectStatus: 'ONGOING',
    featured: true,
    thumbnail: '',
    platforms: splitTags('Web // Android // iOS', 'patient-platforms'),
    technologies: splitTags('PHP // JavaScript // SQL // Bootstrap // Capacitor', 'patient-platform-stack'),
    referenceLabel: '',
    referenceUrl: '',
    confidentialityNote: 'Screens and workflows must use synthetic or redacted data. No patient or internal infrastructure data may be published.',
    sections: [
      projectSection('patient-platform', 'problem', 'The problem', 0, 'Healthcare teams need one dependable path through patient, appointment, and administrative workflows—without making the experience feel clinical to use.'),
      projectSection('patient-platform', 'role', 'My role', 1, 'I develop the product across its web and mobile surfaces, translating operational requirements into maintainable interfaces, data flows, and release-ready features.', ['Build patient and administrative workflows.', 'Connect responsive web behaviour with Android and iOS delivery.', 'Shape technical decisions around privacy, clarity, and maintainability.']),
      projectSection('patient-platform', 'constraints', 'Constraints', 2, 'Healthcare software must remain clear under pressure, work across devices, and protect sensitive information. All portfolio material therefore uses synthetic descriptions and contains no patient data.'),
      projectSection('patient-platform', 'solution', 'Solution', 3, 'A mobile-first platform that brings appointments, patient profiles, provider discovery, availability, and administrative actions into a consistent workflow.', ['Bilingual, role-aware interfaces.', 'Appointment booking, rescheduling, cancellation, and availability handling.', 'Patient profile and administrative workflow support.']),
      projectSection('patient-platform', 'challenges', 'Technical challenges', 4, 'The work balances shared cross-platform behaviour with device-specific expectations, while keeping complex healthcare states understandable and recoverable.'),
      projectSection('patient-platform', 'outcomes', 'Outcome', 5, 'The platform is in active development, with core patient and operational journeys being consolidated into a cleaner multi-platform experience.'),
      projectSection('patient-platform', 'reflection', 'Reflection', 6, 'The strongest healthcare interface is rarely the cleverest one. It is the one that makes the next safe action obvious.'),
    ],
    sortOrder: 0,
    status: 'draft',
  },
  {
    id: 'project-healthcare-corporate-web',
    slug: 'healthcare-corporate-website',
    title: 'Healthcare Corporate Website',
    shortDescription: 'A responsive bilingual healthcare corporate site built as a maintainable Astro frontend.',
    category: 'Corporate Website',
    role: 'Software Engineer',
    organisation: '',
    period: '2026 - Present',
    projectStatus: 'ONGOING',
    featured: true,
    thumbnail: '',
    platforms: splitTags('Web', 'corporate-platforms'),
    technologies: splitTags('Astro // HTML // CSS // JavaScript // Nginx // Linux', 'corporate-stack'),
    referenceLabel: '',
    referenceUrl: '',
    confidentialityNote: 'Only public brand assets and approved corporate content may be shown.',
    sections: [
      projectSection('corporate-web', 'problem', 'The problem', 0, 'The organisation needs a clear, credible digital front door that serves different audiences in two languages and remains easy to maintain.'),
      projectSection('corporate-web', 'role', 'My role', 1, 'I own the frontend implementation, responsive behaviour, content structure, and production-ready delivery of the site.'),
      projectSection('corporate-web', 'solution', 'Solution', 2, 'A lightweight Astro site with reusable content patterns, bilingual navigation, responsive layouts, and a deployment setup suited to a Linux and Nginx environment.'),
      projectSection('corporate-web', 'outcomes', 'Outcome', 3, 'The site is in development with its information architecture and core responsive experience established for approved public content.'),
      projectSection('corporate-web', 'reflection', 'Reflection', 4, 'Corporate sites do not need more noise. They need stronger hierarchy, faster answers, and fewer reasons for visitors to leave confused.'),
    ],
    sortOrder: 3,
    status: 'draft',
  },
  {
    id: 'project-enterprise-analytics',
    slug: 'enterprise-analytics',
    title: 'Enterprise Analytics at Fujitsu',
    shortDescription: 'An anonymised record of enterprise data pipelines, SQL optimisation, and dashboard migration work.',
    category: 'Enterprise Analytics',
    role: 'Senior Systems Engineer',
    organisation: 'Fujitsu',
    period: '2022 - 2026',
    projectStatus: 'COMPLETED',
    featured: true,
    thumbnail: '',
    platforms: splitTags('Enterprise Web // Cloud', 'analytics-platforms'),
    technologies: splitTags('AWS Redshift // S3 // AWS Glue // Lake Formation // Python // SQL // Qlik Sense // Tableau', 'analytics-stack'),
    referenceLabel: '',
    referenceUrl: '',
    confidentialityNote: 'All visuals and datasets must be recreated or anonymised; no client dashboards or proprietary data may be shown.',
    sections: [
      projectSection('enterprise-analytics', 'problem', 'The problem', 0, 'Enterprise reporting depended on complex data pipelines, costly SQL workloads, and dashboards that needed to move between analytics platforms without breaking business continuity.'),
      projectSection('enterprise-analytics', 'role', 'My role', 1, 'I led and delivered work across SQL optimisation, ETL, cloud data services, and business-intelligence migration.', ['Optimise analytical SQL in AWS Redshift.', 'Build and migrate dashboards across Qlik Sense and Tableau.', 'Coordinate data and visualisation changes with delivery teams.']),
      projectSection('enterprise-analytics', 'solution', 'Solution', 2, 'A maintainable reporting flow spanning Redshift, Glue, S3, and Lake Formation, paired with reusable migration patterns for analytics dashboards.'),
      projectSection('enterprise-analytics', 'outcomes', 'Outcome', 3, 'Delivered cost-management and employee-analytics views, supported reporting continuity during platform migration, and earned performance recognition for the work.'),
      projectSection('enterprise-analytics', 'reflection', 'Reflection', 4, 'A dashboard is only the visible end of the system. Trust is built deeper—in definitions, queries, pipelines, and careful migration.'),
    ],
    sortOrder: 5,
    status: 'draft',
  },
  {
    id: 'project-nkos-mobile-commerce',
    slug: 'naturel-kiss-online-shopping',
    title: 'Naturel Kiss Online Shopping (NKOS)',
    shortDescription: 'A bachelor’s-degree Android commerce prototype designed, developed, and validated for mobile purchasing.',
    category: 'Mobile Commerce',
    role: 'Student Software Engineer',
    organisation: 'Universiti Malaysia Pahang',
    period: '2019',
    projectStatus: 'COMPLETED // SILVER MEDAL',
    featured: true,
    thumbnail: '',
    platforms: splitTags('Android', 'nkos-platforms'),
    technologies: splitTags('Java // Android Studio // RAD // UAT', 'nkos-stack'),
    referenceLabel: 'VIEW UMPSA REPOSITORY',
    referenceUrl: 'https://umpir.ump.edu.my/id/eprint/26655/',
    confidentialityNote: 'The linked thesis is a public university repository record. Portfolio claims follow its published abstract.',
    sections: [
      projectSection('nkos', 'problem', 'The problem', 0, 'The business already supported online purchasing through the web, but customers lacked a dedicated mobile application for buying products from anywhere.'),
      projectSection('nkos', 'role', 'My role', 1, 'I designed and developed the Android prototype as my bachelor’s-degree project, then prepared it for client-facing validation.'),
      projectSection('nkos', 'solution', 'Solution', 2, 'A Java-based Android shopping prototype developed through the four Rapid Application Development phases: requirements planning, user design, construction, and cutover.'),
      projectSection('nkos', 'outcomes', 'Outcome', 3, 'Core purchasing features were validated through User Acceptance Testing, the thesis was deposited in the university repository, and the project received a CITREx 2020 Silver Medal.'),
      projectSection('nkos', 'reflection', 'Reflection', 4, 'This project connected requirements, mobile interface design, implementation, and user validation into one complete delivery cycle.'),
    ],
    sortOrder: 8,
    status: 'draft',
  },
  {
    id: 'project-sprint-management-platform',
    slug: 'sprint-management-platform',
    title: 'Sprint Management Platform',
    shortDescription: 'A full-stack internal system developed to support sprint and project-tracking workflows.',
    category: 'Full-Stack Delivery Tool',
    role: 'Systems Engineer',
    organisation: '',
    period: '2022',
    projectStatus: 'COMPLETED',
    featured: true,
    thumbnail: '',
    platforms: splitTags('Web', 'sprint-platforms'),
    technologies: splitTags('Angular // Spring Boot // Scrum', 'sprint-stack'),
    referenceLabel: 'VIEW LINKEDIN PROJECT RECORD',
    referenceUrl: 'https://www.linkedin.com/in/aniqsaidi/',
    confidentialityNote: 'The organisation and internal workflow details are intentionally omitted. No proprietary screens or data are shown.',
    sections: [
      projectSection('sprint-platform', 'problem', 'The problem', 0, 'Project delivery required a clearer way to organise sprint activity and track work through an internal workflow.'),
      projectSection('sprint-platform', 'role', 'My role', 1, 'I developed the system as a full-stack project using Angular and Spring Boot within a Scrum delivery process.'),
      projectSection('sprint-platform', 'solution', 'Solution', 2, 'A web-based sprint-management experience pairing a component-driven frontend with a Java backend.'),
      projectSection('sprint-platform', 'outcomes', 'Outcome', 3, 'Completed as an internal FY2021 project and documented publicly in my professional project history.'),
      projectSection('sprint-platform', 'reflection', 'Reflection', 4, 'Building a tool for delivery teams reinforced that project software should reduce coordination work—not create another project to manage.'),
    ],
    sortOrder: 7,
    status: 'draft',
  },
  {
    id: 'project-cost-management-automation',
    slug: 'cost-management-automation',
    title: 'Cost Management Automation',
    shortDescription: 'A VBA-based cost-management system delivered through a Scrum workflow.',
    category: 'Workflow Automation',
    role: 'Systems Engineer',
    organisation: '',
    period: '2022',
    projectStatus: 'COMPLETED',
    featured: false,
    thumbnail: '',
    platforms: splitTags('Desktop', 'cost-platforms'),
    technologies: splitTags('VBA // Scrum', 'cost-stack'),
    referenceLabel: 'VIEW LINKEDIN PROJECT RECORD',
    referenceUrl: 'https://www.linkedin.com/in/aniqsaidi/',
    confidentialityNote: 'Business data, formulas, and internal operating details are not disclosed.',
    sections: [
      projectSection('cost-automation', 'problem', 'The problem', 0, 'Cost-management work needed a more structured software-assisted workflow.'),
      projectSection('cost-automation', 'role', 'My role', 1, 'I developed the system using VBA and delivered it through a Scrum process.'),
      projectSection('cost-automation', 'solution', 'Solution', 2, 'A focused desktop automation tool built around the organisation’s cost-management workflow.'),
      projectSection('cost-automation', 'outcomes', 'Outcome', 3, 'Completed during FY2022 as an internal delivery project. Exact operational metrics are not publicly available.'),
      projectSection('cost-automation', 'reflection', 'Reflection', 4, 'The best automation is often unglamorous: remove repetition, preserve the rules, and make the next step easier to verify.'),
    ],
    sortOrder: 6,
    status: 'draft',
  },
  {
    id: 'project-e-aduan-hygiene',
    slug: 'e-aduan-hygiene-system',
    title: 'E-Aduan Hygiene System',
    shortDescription: 'A team-developed university cafeteria hygiene complaint concept exhibited at iCE-CInno 2016.',
    category: 'Academic Innovation',
    role: 'Student Project Team Member',
    organisation: 'Universiti Malaysia Pahang',
    period: '2016',
    projectStatus: 'EXHIBITED // BRONZE MEDAL',
    featured: false,
    thumbnail: '',
    platforms: [],
    technologies: [],
    referenceLabel: 'VIEW iCE-CInno PROCEEDING',
    referenceUrl: 'https://icecinno.umpsa.edu.my/index.php/en/online-proceeding2016/2016',
    confidentialityNote: 'The public proceeding verifies the project title and team authorship. Individual responsibilities and technology details are not claimed because they are not documented publicly.',
    sections: [
      projectSection('e-aduan', 'problem', 'The problem', 0, 'Residential-college cafeteria users needed a structured way to raise hygiene-related complaints.'),
      projectSection('e-aduan', 'role', 'My role', 1, 'I contributed as a student project team member. The public proceeding confirms authorship but does not separate individual responsibilities.'),
      projectSection('e-aduan', 'solution', 'Solution', 2, 'A computing-innovation concept centred on receiving and organising cafeteria hygiene complaints.'),
      projectSection('e-aduan', 'outcomes', 'Outcome', 3, 'The project was listed in the iCE-CInno 2016 innovation synopses and received a Bronze Medal.'),
      projectSection('e-aduan', 'reflection', 'Reflection', 4, 'An early lesson in using software to make everyday community issues visible, structured, and easier to act on.'),
    ],
    sortOrder: 9,
    status: 'draft',
  },
  {
    id: 'project-centralized-his',
    slug: 'centralized-hospital-information-system',
    title: 'Centralized Hospital Information System',
    shortDescription: 'An in-house hospital information system connecting patient-facing appointments with hospital-wide operational workflows.',
    category: 'Hospital Information System',
    role: 'Software Engineer',
    organisation: '',
    period: '2026 - Present',
    projectStatus: 'ONGOING',
    featured: true,
    thumbnail: '',
    platforms: splitTags('Web', 'centralized-his-platforms'),
    technologies: splitTags('PHP', 'centralized-his-stack'),
    referenceLabel: '',
    referenceUrl: '',
    confidentialityNote: 'The application name, screens, infrastructure, and operational data are intentionally omitted. The case file describes only the high-level system scope.',
    sections: [
      projectSection('centralized-his', 'problem', 'The problem', 0, 'A patient-facing appointment journey still needs a dependable operational system behind it. Hospitals must coordinate patient records, facilities, doctors, equipment, medications, and other connected workflows from one source of truth.'),
      projectSection('centralized-his', 'role', 'My role', 1, 'I contribute to the in-house development and enhancement of the centralized hospital platform, translating operational requirements into maintainable system workflows.'),
      projectSection('centralized-his', 'solution', 'Solution', 2, 'A centralized Hospital Information System that receives appointment activity from the patient-facing platform and supports the hospital teams responsible for processing it.', ['Connect patient appointment activity with internal hospital workflows.', 'Support interconnected modules for patients, hospitals, doctors, equipment, and medications.', 'Keep complex operational data structured across one expanding system.']),
      projectSection('centralized-his', 'challenges', 'Technical challenges', 3, 'The system spans many dependent domains, so seemingly small changes must preserve data consistency, privacy, and workflow continuity across modules.'),
      projectSection('centralized-his', 'outcomes', 'Current progress', 4, 'The platform is under active development and remains the largest in-house system in the current healthcare portfolio.'),
      projectSection('centralized-his', 'reflection', 'Reflection', 5, 'The patient sees one appointment. The system behind it has to understand the whole hospital.'),
    ],
    sortOrder: 1,
    status: 'draft',
  },
  {
    id: 'project-human-resource-management',
    slug: 'human-resource-management-system',
    title: 'Human Resource Management System',
    shortDescription: 'An in-house workforce platform bringing core staff, attendance, payroll, and leave workflows into one system.',
    category: 'Human Resources Platform',
    role: 'Software Engineer',
    organisation: '',
    period: '2026 - Present',
    projectStatus: 'LIVE // ONGOING',
    featured: true,
    thumbnail: '',
    platforms: splitTags('Web', 'hrms-platforms'),
    technologies: splitTags('.NET Core', 'hrms-stack'),
    referenceLabel: '',
    referenceUrl: '',
    confidentialityNote: 'The application name, employee data, payroll rules, screens, and internal processes are not disclosed. Only the general product scope is described.',
    sections: [
      projectSection('hrms', 'problem', 'The problem', 0, 'Workforce administration becomes fragmented when staff records, attendance, payroll, and leave requests live in separate processes.'),
      projectSection('hrms', 'role', 'My role', 1, 'I contribute to the development and maintenance of the in-house HR platform and its day-to-day workforce workflows.'),
      projectSection('hrms', 'solution', 'Solution', 2, 'A centralized Human Resource Management System covering the core employee lifecycle.', ['Staff profile and employment management.', 'Clock-in, clock-out, and attendance records.', 'Payroll processing workflows.', 'Leave requests and approval handling.']),
      projectSection('hrms', 'challenges', 'Technical challenges', 3, 'HR workflows combine sensitive employee information with policy-heavy calculations and approvals, making correctness, access control, and traceability essential.'),
      projectSection('hrms', 'outcomes', 'Current progress', 4, 'The platform is live and continues to evolve as the organisation’s in-house workforce system.'),
      projectSection('hrms', 'reflection', 'Reflection', 5, 'Good HR software should make policy feel predictable—even when payroll week does not.'),
    ],
    sortOrder: 2,
    status: 'draft',
  },
  {
    id: 'project-healthcare-workforce-portal',
    slug: 'healthcare-workforce-portal',
    title: 'Healthcare Workforce Portal',
    shortDescription: 'A live healthcare-workforce platform connecting facilities, medical professionals, recruitment, scheduling, reporting, and payment workflows.',
    category: 'Healthcare Workforce Platform',
    role: 'Software Engineer',
    organisation: '',
    period: '2026 - Present',
    projectStatus: 'LIVE // ONGOING',
    featured: true,
    thumbnail: '',
    platforms: splitTags('Web', 'workforce-portal-platforms'),
    technologies: [],
    referenceLabel: '',
    referenceUrl: '',
    confidentialityNote: 'The product name, production URL, user records, internal screens, infrastructure, and operating data are intentionally omitted.',
    sections: [
      projectSection('workforce-portal', 'problem', 'The problem', 0, 'Healthcare workforce coordination spans facilities, specialists, medical staff, vacancies, schedules, reporting, and payment processes that are difficult to manage through disconnected workflows.'),
      projectSection('workforce-portal', 'role', 'My role', 1, 'I maintain the live portal, support its operational reliability, and improve the workflows used by healthcare workforce participants.'),
      projectSection('workforce-portal', 'solution', 'Solution', 2, 'An integrated web platform for healthcare workforce management and recruitment.', ['Coordinate healthcare facilities, specialists, and medical staff.', 'Support vacancy listings and locum registration.', 'Manage staff scheduling and workforce activity.', 'Provide operational analytics, reporting, and payment-claim workflows.']),
      projectSection('workforce-portal', 'challenges', 'Technical challenges', 3, 'A live workforce platform must keep scheduling, availability, reporting, and financial workflows dependable while protecting sensitive professional and operational data.'),
      projectSection('workforce-portal', 'outcomes', 'Current progress', 4, 'The platform is live and remains under active maintenance and enhancement.'),
      projectSection('workforce-portal', 'reflection', 'Reflection', 5, 'In workforce software, a schedule is never just a calendar—it is an operating plan with people attached.'),
    ],
    sortOrder: 4,
    status: 'draft',
  },
];

export function migrateV1ToV2(homeInput: HomeContent, fieldsInput: Record<string, string>): CmsPages {
  const home = clone(homeInput);
  const fields = clone(fieldsInput);
  const education = grouped(fields, /^about\.education\.(\d+)\.(qualification|institution|period)$/).map(([index, item]) => ({
    id: stableId('education', `${item.qualification}:${item.institution}`),
    qualification: text(item.qualification),
    institution: text(item.institution),
    period: text(item.period),
    earlierRecord: index > 0,
    sortOrder: index,
    status: 'published' as const,
  }));

  const jobGroups = new Map<number, Record<string, string>>();
  const highlightGroups = new Map<number, Map<number, string>>();
  for (const [key, value] of Object.entries(fields)) {
    const base = key.match(/^experience\.jobs\.(\d+)\.(role|company|location|period|skills)$/);
    if (base) jobGroups.set(Number(base[1]), { ...jobGroups.get(Number(base[1])), [base[2]]: value });
    const point = key.match(/^experience\.jobs\.(\d+)\.highlights\.(\d+)$/);
    if (point) {
      const jobIndex = Number(point[1]);
      const points = highlightGroups.get(jobIndex) ?? new Map<number, string>();
      points.set(Number(point[2]), value);
      highlightGroups.set(jobIndex, points);
    }
  }
  const jobs: ExperienceRecord[] = [...jobGroups.entries()].sort(([a], [b]) => a - b).map(([index, item]) => {
    const id = stableId('experience', `${item.role}:${item.company}:${item.period}`);
    const dates = text(item.period).match(/([A-Z][a-z]{2})\s+(\d{4})\s+-\s+(?:([A-Z][a-z]{2})\s+(\d{4})|Present)/);
    const highlights = [...(highlightGroups.get(index) ?? new Map()).entries()].sort(([a], [b]) => a - b).map(([pointIndex, point]) => ({
      id: stableId('point', `${id}:${point}`), text: point, sortOrder: pointIndex, status: 'published' as const,
    }));
    return {
      id,
      role: text(item.role), company: text(item.company), location: text(item.location), period: text(item.period),
      startDate: dates ? `${dates[2]}-${String(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(dates[1]) + 1).padStart(2, '0')}` : '',
      endDate: dates?.[4] ? `${dates[4]}-${String(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(dates[3]) + 1).padStart(2, '0')}` : '',
      current: /present/i.test(text(item.period)), featured: index === 0,
      highlights, technologies: splitTags(item.skills, `${id}:technologies`),
      sortOrder: index, status: 'published',
    };
  });

  const toolkit: ToolkitRecord[] = grouped(fields, /^experience\.toolkit\.(\d+)\.(group|skills)$/).map(([index, item]) => ({
    id: stableId('toolkit', text(item.group)), group: text(item.group), technologies: splitTags(item.skills, `toolkit:${item.group}`),
    sortOrder: index, status: 'published',
  }));
  const certificationRecords: CertificationRecord[] = grouped(fields, /^certifications\.(\d+)\.(title|issuer|date)$/).map(([index, item]) => ({
    id: stableId('certification', `${item.title}:${item.issuer}`), title: text(item.title), issuer: text(item.issuer), issuedAt: text(item.date),
    category: /Scrum\.org/i.test(text(item.issuer)) ? 'professional' : /Amazon Web Services/i.test(text(item.issuer)) ? 'cloud' : 'learning',
    credentialUrl: '', featured: /Professional Scrum Master|Tableau 2024\.1|Security Best Practices/i.test(text(item.title)), sortOrder: index, status: 'published',
  }));
  const awardRecords: AwardRecord[] = grouped(fields, /^awards\.(\d+)\.(title|detail)$/).map(([index, item]) => ({
    id: stableId('award', `${item.title}:${item.detail}`), title: text(item.title), issuer: '', date: '', description: text(item.detail),
    category: '', featured: [0, 1, 5].includes(index), sortOrder: index, status: 'published',
  }));
  const leadershipRecords: LeadershipRecord[] = grouped(fields, /^leadership\.(\d+)\.(title|detail)$/).map(([index, item]) => ({
    id: stableId('leadership', `${item.title}:${item.detail}`), role: text(item.title), organisation: '', period: '', description: text(item.detail),
    scope: '', earlierRecord: index >= 6, featured: [0, 1, 4].includes(index), sortOrder: index, status: 'published',
  }));

  const archiveMap = new Map<string, Record<string, string>>();
  for (const [key, value] of Object.entries(fields)) {
    const match = key.match(/^archives\.([^.]+)\.(title|publication|date|description)$/);
    if (match) archiveMap.set(match[1], { ...archiveMap.get(match[1]), [match[2]]: value });
  }
  const articles: ArchiveRecord[] = [...archiveMap.entries()].sort(([, a], [, b]) => text(b.date).localeCompare(text(a.date))).map(([slug, item], index) => ({
    id: stableId('archive', slug), slug, title: text(item.title), publication: text(item.publication), publicationDate: text(item.date),
    description: text(item.description), sourceUrl: '', assetPath: `/archives/${slug}/`, language: 'English / Malay', featured: false,
    sortOrder: index, status: 'published',
  }));

  return {
    home: { schemaVersion: 2, pageId: 'home', title: 'HOME', data: {
      profile: clone(home.profile),
      queue: home.queue.map((item, index) => ({ ...item, sortOrder: index, status: 'published' })),
      callsToAction: [
        { id: 'cta-profile', label: 'VIEW PROFILE', url: '/about/', external: false, sortOrder: 0, status: 'published' },
        { id: 'cta-email', label: 'EMAIL', url: `mailto:${home.profile.email}`, external: true, sortOrder: 1, status: 'published' },
        { id: 'cta-linkedin', label: 'LINKEDIN', url: home.profile.linkedin, external: true, sortOrder: 2, status: 'published' },
      ],
    } },
    about: { schemaVersion: 2, pageId: 'about', title: 'ABOUT', data: {
      name: text(fields['about.name']), role: text(fields['about.role']), location: text(fields['about.location']),
      email: text(fields['about.email']), linkedin: text(fields['about.linkedin']), education,
    } },
    projects: { schemaVersion: 2, pageId: 'projects', title: 'PROJECTS', data: { projects: clone(defaultProjects) } },
    experience: { schemaVersion: 2, pageId: 'experience', title: 'EXPERIENCE', data: { jobs, toolkit } },
    certifications: { schemaVersion: 2, pageId: 'certifications', title: 'CERTIFICATIONS', data: { certifications: certificationRecords } },
    awards: { schemaVersion: 2, pageId: 'awards', title: 'AWARDS', data: { awards: awardRecords } },
    leadership: { schemaVersion: 2, pageId: 'leadership', title: 'LEADERSHIP', data: { leadership: leadershipRecords } },
    archives: { schemaVersion: 2, pageId: 'archives', title: 'ARCHIVES', data: { lede: text(fields['archives.lede']), articles } },
  };
}

function recordIssues(records: CmsRecord[], path: string) {
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  records.forEach((record, index) => {
    if (!record.id?.trim()) issues.push({ path: `${path}.${index}.id`, message: 'Stable ID is required.' });
    if (ids.has(record.id)) issues.push({ path: `${path}.${index}.id`, message: 'Stable ID must be unique.' });
    ids.add(record.id);
    if (!Number.isInteger(record.sortOrder) || record.sortOrder < 0) issues.push({ path: `${path}.${index}.sortOrder`, message: 'Sort order must be a non-negative integer.' });
    if (!['draft', 'published', 'archived'].includes(record.status)) issues.push({ path: `${path}.${index}.status`, message: 'Record status is invalid.' });
  });
  return issues;
}

export function validateCmsPage(page: CmsPage): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (page.schemaVersion !== 2) issues.push({ path: 'schemaVersion', message: 'Schema version must be 2.' });
  if (!CMS_PAGE_IDS.includes(page.pageId)) issues.push({ path: 'pageId', message: 'Page ID is invalid.' });
  if (!page.title?.trim()) issues.push({ path: 'title', message: 'Page title is required.' });
  if (!page.data || typeof page.data !== 'object' || Array.isArray(page.data)) return [...issues, { path: 'data', message: 'Page data must be an object.' }];

  const required = (value: unknown, path: string) => {
    if (typeof value !== 'string' || !value.trim()) issues.push({ path, message: 'This field is required.' });
  };
  const unique = (values: string[], path: string, label: string) => {
    const seen = new Set<string>();
    values.forEach((value, index) => {
      const key = value.trim().toLowerCase();
      if (key && seen.has(key)) issues.push({ path: `${path}.${index}`, message: `${label} must be unique.` });
      seen.add(key);
    });
  };
  const validUrl = (value: string, path: string, allowRelative = false) => {
    if (!value) return;
    if (allowRelative && (value.startsWith('/') || value.startsWith('mailto:'))) return;
    try { new URL(value); } catch { issues.push({ path, message: 'Enter a valid URL.' }); }
  };
  const recordsAt = (key: string) => Array.isArray((page.data as Record<string, unknown>)[key])
    ? (page.data as Record<string, unknown>)[key] as CmsRecord[] : [];

  if (page.pageId === 'home') {
    const data = page.data as CmsPages['home']['data'];
    required(data.profile?.greeting, 'profile.greeting'); required(data.profile?.role, 'profile.role');
    required(data.profile?.email, 'profile.email');
    issues.push(...recordIssues(data.queue ?? [], 'queue'), ...recordIssues(data.callsToAction ?? [], 'callsToAction'));
    data.queue?.forEach((item, index) => { required(item.label, `queue.${index}.label`); required(item.description, `queue.${index}.description`); });
    data.callsToAction?.forEach((item, index) => { required(item.label, `callsToAction.${index}.label`); required(item.url, `callsToAction.${index}.url`); validUrl(item.url, `callsToAction.${index}.url`, true); });
  } else if (page.pageId === 'about') {
    const data = page.data as CmsPages['about']['data'];
    required(data.name, 'name'); required(data.role, 'role'); required(data.email, 'email');
    issues.push(...recordIssues(data.education ?? [], 'education'));
    validUrl(data.linkedin, 'linkedin');
    data.education?.forEach((item, index) => { required(item.qualification, `education.${index}.qualification`); required(item.institution, `education.${index}.institution`); });
  } else {
    const collectionKey: Record<Exclude<CmsPageId, 'home' | 'about' | 'experience' | 'archives'>, string> = {
      projects: 'projects', certifications: 'certifications', awards: 'awards', leadership: 'leadership',
    };
    if (page.pageId === 'experience') {
      const data = page.data as CmsPages['experience']['data'];
      issues.push(...recordIssues(data.jobs ?? [], 'jobs'), ...recordIssues(data.toolkit ?? [], 'toolkit'));
      data.jobs?.forEach((job, index) => {
        required(job.role, `jobs.${index}.role`); required(job.company, `jobs.${index}.company`);
        issues.push(...recordIssues(job.highlights ?? [], `jobs.${index}.highlights`), ...recordIssues(job.technologies ?? [], `jobs.${index}.technologies`));
        job.highlights?.forEach((item, itemIndex) => required(item.text, `jobs.${index}.highlights.${itemIndex}.text`));
        job.technologies?.forEach((item, itemIndex) => required(item.label, `jobs.${index}.technologies.${itemIndex}.label`));
      });
      data.toolkit?.forEach((item, index) => {
        required(item.group, `toolkit.${index}.group`); issues.push(...recordIssues(item.technologies ?? [], `toolkit.${index}.technologies`));
      });
    } else if (page.pageId === 'archives') {
      const data = page.data as CmsPages['archives']['data'];
      required(data.lede, 'lede'); issues.push(...recordIssues(data.articles ?? [], 'articles'));
      unique(data.articles.map((item) => item.slug), 'articles', 'Article slug');
      data.articles?.forEach((item, index) => {
        required(item.title, `articles.${index}.title`); required(item.slug, `articles.${index}.slug`);
        required(item.publication, `articles.${index}.publication`); required(item.publicationDate, `articles.${index}.publicationDate`);
        validUrl(item.sourceUrl, `articles.${index}.sourceUrl`);
      });
    } else {
      const key = collectionKey[page.pageId];
      const records = recordsAt(key);
      issues.push(...recordIssues(records, key));
      records.forEach((record, index) => {
        const candidate = record as unknown as Record<string, unknown>;
        required(candidate.title ?? candidate.role, `${key}.${index}.${'title' in candidate ? 'title' : 'role'}`);
        if ('slug' in candidate) required(candidate.slug, `${key}.${index}.slug`);
      });
      if (page.pageId === 'projects') {
        const projects = (page.data as CmsPages['projects']['data']).projects;
        unique(projects.map((item) => item.slug), 'projects', 'Project slug');
        projects.forEach((project, index) => {
          required(project.shortDescription, `projects.${index}.shortDescription`); required(project.role, `projects.${index}.role`);
          validUrl(project.referenceUrl, `projects.${index}.referenceUrl`);
          issues.push(...recordIssues(project.platforms, `projects.${index}.platforms`), ...recordIssues(project.technologies, `projects.${index}.technologies`), ...recordIssues(project.sections, `projects.${index}.sections`));
          project.sections.forEach((section, sectionIndex) => {
            required(section.heading, `projects.${index}.sections.${sectionIndex}.heading`);
            issues.push(...recordIssues(section.points, `projects.${index}.sections.${sectionIndex}.points`));
          });
        });
      } else if (page.pageId === 'certifications') {
        (page.data as CmsPages['certifications']['data']).certifications.forEach((item, index) => {
          required(item.issuer, `certifications.${index}.issuer`); required(item.issuedAt, `certifications.${index}.issuedAt`);
          validUrl(item.credentialUrl, `certifications.${index}.credentialUrl`);
        });
      } else if (page.pageId === 'awards') {
        (page.data as CmsPages['awards']['data']).awards.forEach((item, index) => required(item.description, `awards.${index}.description`));
      } else if (page.pageId === 'leadership') {
        (page.data as CmsPages['leadership']['data']).leadership.forEach((item, index) => required(item.description, `leadership.${index}.description`));
      }
    }
  }
  return issues;
}

export function validateCmsPages(pages: CmsPages) {
  return CMS_PAGE_IDS.flatMap((pageId) => validateCmsPage(pages[pageId]).map((issue) => ({ ...issue, path: `${pageId}.${issue.path}` })));
}

export function sortRecords<T extends CmsRecord>(records: T[]) {
  return [...records].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

export function normalizeOrder<T extends CmsRecord>(records: T[]) {
  return sortRecords(records).map((record, index) => ({ ...record, sortOrder: index }));
}

export function isCmsPage(value: unknown, pageId?: CmsPageId): value is CmsPage {
  if (!value || typeof value !== 'object') return false;
  const page = value as CmsPage;
  return page.schemaVersion === 2
    && CMS_PAGE_IDS.includes(page.pageId)
    && (!pageId || page.pageId === pageId)
    && typeof page.title === 'string'
    && Boolean(page.data)
    && typeof page.data === 'object'
    && !Array.isArray(page.data);
}

export function cmsV2ToV1(pages: CmsPages): { home: HomeContent; fields: Record<string, string> } {
  const fields: Record<string, string> = {};
  const about = pages.about.data;
  Object.assign(fields, {
    'about.name': about.name, 'about.role': about.role, 'about.location': about.location,
    'about.email': about.email, 'about.linkedin': about.linkedin,
  });
  normalizeOrder(about.education).filter((item) => item.status === 'published').forEach((item, index) => {
    fields[`about.education.${index}.qualification`] = item.qualification;
    fields[`about.education.${index}.institution`] = item.institution;
    fields[`about.education.${index}.period`] = item.period;
  });
  normalizeOrder(pages.experience.data.jobs).filter((item) => item.status === 'published').forEach((job, index) => {
    fields[`experience.jobs.${index}.role`] = job.role; fields[`experience.jobs.${index}.company`] = job.company;
    fields[`experience.jobs.${index}.location`] = job.location; fields[`experience.jobs.${index}.period`] = job.period;
    normalizeOrder(job.highlights).filter((item) => item.status === 'published').forEach((point, pointIndex) => fields[`experience.jobs.${index}.highlights.${pointIndex}`] = point.text);
    fields[`experience.jobs.${index}.skills`] = normalizeOrder(job.technologies).filter((item) => item.status === 'published').map((item) => item.label).join(' // ');
  });
  normalizeOrder(pages.experience.data.toolkit).filter((item) => item.status === 'published').forEach((item, index) => {
    fields[`experience.toolkit.${index}.group`] = item.group;
    fields[`experience.toolkit.${index}.skills`] = normalizeOrder(item.technologies).filter((tag) => tag.status === 'published').map((tag) => tag.label).join(', ');
  });
  normalizeOrder(pages.certifications.data.certifications).filter((item) => item.status === 'published').forEach((item, index) => {
    fields[`certifications.${index}.title`] = item.title; fields[`certifications.${index}.issuer`] = item.issuer; fields[`certifications.${index}.date`] = item.issuedAt;
  });
  normalizeOrder(pages.awards.data.awards).filter((item) => item.status === 'published').forEach((item, index) => {
    fields[`awards.${index}.title`] = item.title; fields[`awards.${index}.detail`] = item.description;
  });
  normalizeOrder(pages.leadership.data.leadership).filter((item) => item.status === 'published').forEach((item, index) => {
    fields[`leadership.${index}.title`] = item.role; fields[`leadership.${index}.detail`] = item.description;
  });
  fields['archives.lede'] = pages.archives.data.lede;
  normalizeOrder(pages.archives.data.articles).filter((item) => item.status === 'published').forEach((item) => {
    fields[`archives.${item.slug}.title`] = item.title; fields[`archives.${item.slug}.publication`] = item.publication;
    fields[`archives.${item.slug}.date`] = item.publicationDate; fields[`archives.${item.slug}.description`] = item.description;
  });
  return {
    home: {
      schemaVersion: 1,
      profile: clone(pages.home.data.profile),
      queue: normalizeOrder(pages.home.data.queue).filter((item) => item.status === 'published').slice(0, 5).map(({ id, label, description }) => ({ id: id as HomeContent['queue'][number]['id'], label, description })),
    },
    fields,
  };
}

export function sanitizeCmsPage<T extends CmsPage>(value: unknown, fallback: T): T {
  if (!value || typeof value !== 'object') return clone(fallback);
  const candidate = clone(value) as T;
  if (candidate.schemaVersion !== 2 || candidate.pageId !== fallback.pageId || !candidate.data) return clone(fallback);
  return candidate;
}
