// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://aniqsaidi.web.app',
  markdown: {
    // подсветка кода отключена: весь код рисуется одним «фосфорным» цветом,
    // как на настоящем терминале
    syntaxHighlight: false,
  },
});
