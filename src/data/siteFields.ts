import { awards, certifications, education, experience, leadership, profile, skillGroups } from './cv';

export interface SiteFieldDefinition {
  key: string;
  label: string;
  value: string;
  multiline?: boolean;
  type?: 'text' | 'email' | 'url';
}

export interface SiteFieldSection {
  id: string;
  title: string;
  fields: SiteFieldDefinition[];
}

const field = (
  key: string,
  label: string,
  value: string,
  options: Pick<SiteFieldDefinition, 'multiline' | 'type'> = {},
): SiteFieldDefinition => ({ key, label, value, ...options });

export const siteFieldSections: SiteFieldSection[] = [
  {
    id: 'about',
    title: 'ABOUT',
    fields: [
      field('about.name', 'NAME', profile.name),
      field('about.role', 'ROLE', profile.role),
      field('about.location', 'LOCATION', profile.location),
      field('about.email', 'EMAIL', profile.email, { type: 'email' }),
      field('about.linkedin', 'LINKEDIN', profile.linkedin, { type: 'url' }),
      ...education.flatMap((item, index) => [
        field(`about.education.${index}.qualification`, `EDUCATION ${index + 1} // QUALIFICATION`, item.qualification),
        field(`about.education.${index}.institution`, `EDUCATION ${index + 1} // INSTITUTION`, item.institution),
        field(`about.education.${index}.period`, `EDUCATION ${index + 1} // PERIOD`, item.period),
      ]),
    ],
  },
  {
    id: 'experience',
    title: 'EXPERIENCE & TOOLKIT',
    fields: [
      ...experience.flatMap((job, index) => [
        field(`experience.jobs.${index}.role`, `JOB ${index + 1} // ROLE`, job.role),
        field(`experience.jobs.${index}.company`, `JOB ${index + 1} // COMPANY`, job.company),
        field(`experience.jobs.${index}.location`, `JOB ${index + 1} // LOCATION`, job.location),
        field(`experience.jobs.${index}.period`, `JOB ${index + 1} // PERIOD`, job.period),
        ...job.highlights.map((highlight, highlightIndex) =>
          field(`experience.jobs.${index}.highlights.${highlightIndex}`, `JOB ${index + 1} // POINT ${highlightIndex + 1}`, highlight, { multiline: true })),
        field(`experience.jobs.${index}.skills`, `JOB ${index + 1} // STACK`, job.skills.join(' // '), { multiline: true }),
      ]),
      ...skillGroups.flatMap(([group, skills], index) => [
        field(`experience.toolkit.${index}.group`, `TOOLKIT ${index + 1} // GROUP`, group),
        field(`experience.toolkit.${index}.skills`, `TOOLKIT ${index + 1} // SKILLS`, skills, { multiline: true }),
      ]),
    ],
  },
  {
    id: 'certifications',
    title: 'CERTIFICATIONS',
    fields: certifications.flatMap((item, index) => [
      field(`certifications.${index}.title`, `CERT ${index + 1} // TITLE`, item.title),
      field(`certifications.${index}.issuer`, `CERT ${index + 1} // ISSUER`, item.issuer),
      field(`certifications.${index}.date`, `CERT ${index + 1} // DATE`, item.date),
    ]),
  },
  {
    id: 'awards',
    title: 'AWARDS',
    fields: awards.flatMap(([title, detail], index) => [
      field(`awards.${index}.title`, `AWARD ${index + 1} // TITLE`, title),
      field(`awards.${index}.detail`, `AWARD ${index + 1} // DETAIL`, detail, { multiline: true }),
    ]),
  },
  {
    id: 'leadership',
    title: 'LEADERSHIP',
    fields: leadership.flatMap(([title, detail], index) => [
      field(`leadership.${index}.title`, `ROLE ${index + 1} // TITLE`, title),
      field(`leadership.${index}.detail`, `ROLE ${index + 1} // DETAIL`, detail, { multiline: true }),
    ]),
  },
];

export const defaultSiteFields = Object.fromEntries(
  siteFieldSections.flatMap((section) => section.fields.map((item) => [item.key, item.value])),
) as Record<string, string>;

export const SITE_FIELDS_DRAFT_KEY = 'aniq-site-fields-draft-v1';
export const SITE_FIELDS_PUBLISHED_KEY = 'aniq-site-fields-published-v1';

export function normalizeSiteFields(value: unknown, defaults = defaultSiteFields) {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const keys = new Set([
    ...Object.keys(defaults),
    ...Object.keys(input).filter((key) => key.startsWith('archives.')),
  ]);
  return Object.fromEntries([...keys].map((key) => {
    const fallback = defaults[key] ?? '';
    const candidate = input[key];
    return [key, typeof candidate === 'string' && candidate.trim() ? candidate.trim().slice(0, 1000) : fallback];
  })) as Record<string, string>;
}
