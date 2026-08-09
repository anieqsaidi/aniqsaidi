/// <reference types="astro/client" />

declare const __SITE_VERSION__: string;
declare const __SITE_BUILD_ID__: string;

interface ImportMetaEnv {
  readonly PUBLIC_GA_MEASUREMENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
