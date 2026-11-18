import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import scrollableTables from './scripts/scrollable-tables.mjs';

export default defineConfig({
  site: 'https://delegation-kit.sh',
  integrations: [mdx(), sitemap()],
  redirects: { '/dispatch': '/docs/dispatch/' },
  markdown: { rehypePlugins: [scrollableTables] },
  vite: {
    plugins: [tailwindcss()]
  }
});
