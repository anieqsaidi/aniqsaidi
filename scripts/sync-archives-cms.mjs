import { createRequire } from 'node:module';

const PROJECT_ID = 'aniqsaidi';
const ADMIN_UID = '1Mhzu5HmjdU82yzGlph6gQHX1843';
const deploy = process.argv.includes('--deploy');

const currentArticles = [
  {
    id: 'archive-award',
    slug: 'award',
    title: 'Deputy Vice-Chancellor Award Recognition',
    publication: 'UMPSA News',
    publicationDate: '2019-03-05',
    description: 'UMPSA coverage records Aniq as the Deputy Vice-Chancellor Award recipient during the university’s 2018 Co-curricular Award and Student Appreciation ceremony.',
    sourceUrl: 'https://news.umpsa.edu.my/awards/kombinasi-minat-dan-bakat-kepimpinan-siti-aisyah-dinobatkan-tokoh-siswa-ump',
    assetPath: '/archives/award/',
    language: 'English / Malay',
    featured: false,
    sortOrder: 0,
    status: 'published',
  },
  {
    id: 'archive-leadership',
    slug: 'leadership',
    title: 'NC Seru Mahasiswa UMP Memperkaya Pengalaman Kampus',
    publication: 'UMPSA News',
    publicationDate: '2018-11-30',
    description: 'UMPSA records the university’s appreciation for the outgoing 2017/2018 Student Representative Council led by Aniq and its contribution to student leadership.',
    sourceUrl: 'https://news.umpsa.edu.my/general/nc-seru-mahasiswa-ump-memperkaya-pengalaman-kampus',
    assetPath: '/archives/leadership/',
    language: 'Malay',
    featured: false,
    sortOrder: 0,
    status: 'published',
  },
  {
    id: 'archive-heart',
    slug: 'heart',
    title: 'Run for Your Heart',
    publication: 'Pekan Review, Vol. 12',
    publicationDate: '2017-09-30',
    description: 'Pekan Review coverage of UMP’s World Heart Day and Balloon Run records Aniq attending as head of the Student Representative Council.',
    sourceUrl: 'https://www.umpsa.edu.my/publication/pekan-review/pekan-review-vol-12.pdf#page=43',
    assetPath: '/archives/heart/',
    language: 'English',
    featured: false,
    sortOrder: 0,
    status: 'published',
  },
];

const canonicalArticleUpdates = new Map([
  ['harapan', { publicationDate: '2018-10-29' }],
]);

const decode = (value) => {
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('timestampValue' in value) return { $timestamp: value.timestampValue };
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(decode);
  if ('mapValue' in value) return Object.fromEntries(
    Object.entries(value.mapValue.fields ?? {}).map(([key, item]) => [key, decode(item)]),
  );
  throw new TypeError(`Unsupported Firestore value: ${Object.keys(value).join(', ')}`);
};

const encode = (value) => {
  if (value === null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  if (typeof value === 'object' && '$timestamp' in value) return { timestampValue: value.$timestamp };
  if (typeof value === 'object') return {
    mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)])) },
  };
  throw new TypeError(`Unsupported value: ${typeof value}`);
};

const require = createRequire(import.meta.url);
const auth = require('/usr/local/lib/node_modules/firebase-tools/lib/auth.js');
const account = auth.getGlobalDefaultAccount();
if (!account?.tokens?.refresh_token) throw new Error('Firebase CLI authentication is unavailable.');
const token = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
const baseUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const documents = await Promise.all(['cmsDrafts', 'cmsPublished'].map(async (collection) => {
  const response = await fetch(`${baseUrl}/${collection}/archives`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!response.ok) throw new Error(`Could not read ${collection}/archives: HTTP ${response.status}`);
  const raw = await response.json();
  const data = Object.fromEntries(Object.entries(raw.fields ?? {}).map(([key, value]) => [key, decode(value)]));
  return { collection, raw, data };
}));

const writes = documents.map(({ collection, raw, data }) => {
  const articles = [...(data.data?.articles ?? [])].map((article) => ({
    ...article,
    ...(canonicalArticleUpdates.get(article.slug) ?? {}),
  }));
  const existing = new Set(articles.map((article) => article.slug));
  articles.push(...currentArticles.filter((article) => !existing.has(article.slug)));
  articles.sort((a, b) => b.publicationDate.localeCompare(a.publicationDate) || a.title.localeCompare(b.title));
  articles.forEach((article, index) => { article.sortOrder = index; });

  const now = new Date().toISOString();
  const next = {
    ...data,
    data: { ...data.data, articles },
    updatedAt: { $timestamp: now },
    updatedBy: ADMIN_UID,
    version: Number(data.version ?? 0) + 1,
  };
  if (collection === 'cmsPublished') next.publishedAt = { $timestamp: now };

  console.log(`${collection}/archives: ${data.data?.articles?.length ?? 0} -> ${articles.length} records; version ${data.version ?? 0} -> ${next.version}`);
  return {
    update: {
      name: `${baseUrl.replace('https://firestore.googleapis.com/v1/', '')}/${collection}/archives`,
      fields: Object.fromEntries(Object.entries(next).map(([key, value]) => [key, encode(value)])),
    },
    currentDocument: { updateTime: raw.updateTime },
  };
});

if (!deploy) {
  console.log('Dry run only. Pass --deploy to commit these changes.');
  process.exit(0);
}

const response = await fetch(`${baseUrl}:commit`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ writes }),
});
if (!response.ok) throw new Error(`Archives sync failed with HTTP ${response.status}: ${await response.text()}`);
const result = await response.json();
console.log(`Committed ${result.writeResults?.length ?? 0} Archives CMS documents.`);
