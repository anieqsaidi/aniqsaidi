// @ts-check
import { defineConfig } from 'astro/config';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { adminSnapshot, BATAM_ACCOUNTS, documentForAccount, profileForAccount } from './functions/batam-trip.mjs';

const packageMetadata = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Build timestamp in UTC+8 (Malaysia Time)
const buildDate = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
const buildTimestamp = `${buildDate.slice(0, 10).replaceAll('-', '')}.${buildDate.slice(11, 16).replace(':', '')}`;

function currentCommit() {
  const deployedCommit = process.env.GITHUB_SHA || process.env.GIT_COMMIT || process.env.COMMIT_SHA;
  if (deployedCommit) return deployedCommit.slice(0, 7).toUpperCase();
  try {
    return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { encoding: 'utf8' }).trim().toUpperCase();
  } catch {
    return 'LOCAL';
  }
}

const buildId = `${buildTimestamp}-${currentCommit()}`;

function batamDevelopmentApi() {
  const sessions = new Map();
  const json = (response, status, data) => {
    response.statusCode = status;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'private, no-store');
    response.end(JSON.stringify(data));
  };
  const body = async (request) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  };
  return {
    name: 'batam-development-api',
    configureServer(server) {
      server.middlewares.use('/api/batam/login', async (request, response) => {
        if (request.method !== 'POST') return json(response, 405, { ok: false, message: 'Method not allowed.' });
        try {
          const data = await body(request);
          const username = String(data.username ?? '').trim().toLowerCase();
          const pin = String(data.pin ?? '').trim();
          const account = BATAM_ACCOUNTS[username];
          if (!account || account.pin !== pin) return json(response, 401, { ok: false, message: 'Username or PIN is incorrect.' });
          const token = `dev_${randomBytes(24).toString('base64url')}`;
          sessions.set(token, username);
          return json(response, 200, { ok: true, token });
        } catch {
          return json(response, 400, { ok: false, message: 'The login request is invalid.' });
        }
      });
      server.middlewares.use('/api/batam/profile', (request, response) => {
        if (request.method !== 'GET') return json(response, 405, { ok: false, message: 'Method not allowed.' });
        const authorization = String(request.headers.authorization ?? '');
        const username = sessions.get(authorization.replace(/^Bearer /, ''));
        const profile = username ? profileForAccount(username) : null;
        if (!profile) return json(response, 401, { ok: false, message: 'Your local session has expired. Please sign in again.' });
        return json(response, 200, { ok: true, profile });
      });
      server.middlewares.use('/api/batam/document', async (request, response) => {
        const authorization = String(request.headers.authorization ?? '');
        const username = sessions.get(authorization.replace(/^Bearer /, ''));
        const id = new URL(request.url || '/', 'http://localhost').searchParams.get('id');
        const document = username && id ? documentForAccount(username, id) : null;
        if (!document) return json(response, 401, { ok: false, message: 'Document unavailable.' });
        try {
          const upstream = await fetch(`https://drive.google.com/uc?export=download&id=${encodeURIComponent(document.driveId)}`);
          if (!upstream.ok) throw new Error('Drive unavailable');
          response.statusCode = 200;
          response.setHeader('Content-Type', 'application/pdf');
          response.end(Buffer.from(await upstream.arrayBuffer()));
        } catch { return json(response, 502, { ok: false, message: 'Document unavailable.' }); }
      });
      server.middlewares.use('/api/batam/admin', async (request, response) => {
        if (request.method === 'GET') return json(response, 200, { ok: true, data: { ...adminSnapshot(), sessions: [] } });
        if (request.method === 'POST') return json(response, 200, { ok: true, revoked: 0 });
        return json(response, 405, { ok: false, message: 'Method not allowed.' });
      });
    },
  };
}

// https://astro.build/config
export default defineConfig({
  site: 'https://aniqsaidi.my',
  vite: {
    plugins: [batamDevelopmentApi()],
    build: {
      // The full Firebase SDK is isolated to authenticated admin routes.
      // Public pages use the much smaller Firestore Lite bundle.
      chunkSizeWarningLimit: 550,
    },
    define: {
      __SITE_VERSION__: JSON.stringify(packageMetadata.version),
      __SITE_BUILD_ID__: JSON.stringify(buildId),
    },
  },
  markdown: {
    // подсветка кода отключена: весь код рисуется одним «фосфорным» цветом,
    // как на настоящем терминале
    syntaxHighlight: false,
  },
});
