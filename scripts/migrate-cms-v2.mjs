import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CMS_PAGE_IDS, migrateV1ToV2, validateCmsPages } from '../src/data/cmsSchema.ts';

const PROJECT_ID = 'aniqsaidi';
const ADMIN_UID = '1Mhzu5HmjdU82yzGlph6gQHX1843';
const sourcePath = resolve('backups/site-content-v1-2026-08-05.json');
const outputPath = resolve('backups/site-content-v2-2026-08-05.json');
const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const home = structuredClone(source.documents.home.data);
const fields = structuredClone(source.documents.pages.data.fields);
delete home.publishedAt;
delete home.updatedAt;
const pages = migrateV1ToV2(home, fields);
const issues = validateCmsPages(pages);
if (issues.length) throw new Error(`Migration validation failed: ${issues[0].path} — ${issues[0].message}`);

const snapshot = {
  exportedAt: new Date().toISOString(),
  source: 'Firestore siteContent v1 backup',
  schemaVersion: 2,
  documents: Object.fromEntries(CMS_PAGE_IDS.map((pageId) => [`cmsDrafts/${pageId}`, pages[pageId]])),
};
await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

if (!process.argv.includes('--deploy')) {
  console.log(`Generated ${outputPath}`);
  console.log(`Validated ${CMS_PAGE_IDS.length} page-scoped v2 documents.`);
  process.exit(0);
}

const encode = (value) => {
  if (value === null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  if (typeof value === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)])) } };
  throw new TypeError(`Unsupported Firestore value: ${typeof value}`);
};

const require = createRequire(import.meta.url);
const auth = require('/usr/local/lib/node_modules/firebase-tools/lib/auth.js');
const account = auth.getGlobalDefaultAccount();
if (!account?.tokens?.refresh_token) throw new Error('Firebase CLI authentication is unavailable. Run firebase login first.');
const token = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
const writes = CMS_PAGE_IDS.map((pageId) => {
  const data = { ...pages[pageId], updatedBy: ADMIN_UID };
  const encoded = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, encode(value)]));
  encoded.updatedAt = { timestampValue: new Date().toISOString() };
  return {
    update: {
      name: `projects/${PROJECT_ID}/databases/(default)/documents/cmsDrafts/${pageId}`,
      fields: encoded,
    },
  };
});
const response = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ writes }),
});
if (!response.ok) throw new Error(`Firestore migration failed with HTTP ${response.status}: ${await response.text()}`);
const result = await response.json();
console.log(`Migrated ${result.writeResults?.length ?? 0} v2 draft documents to ${PROJECT_ID}.`);
console.log('Public v1 documents were not changed.');
