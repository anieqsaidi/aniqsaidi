// @ts-check
import { defineConfig } from 'astro/config';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

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

// https://astro.build/config
export default defineConfig({
  site: 'https://aniqsaidi.my',
  vite: {
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
