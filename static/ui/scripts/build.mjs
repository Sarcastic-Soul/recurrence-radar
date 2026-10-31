// Builds each Forge Custom UI resource on its own:
//   build/<page>/index.html + build/<page>/assets/*
// Forge serves every resource folder as a separate static site, so a page
// must never reference files outside its own folder.
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rmSync, readFileSync, readdirSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const ui = resolve(here, '..');
const pages = ['panel', 'glance', 'admin', 'overview'];

rmSync(resolve(ui, 'build'), { recursive: true, force: true });

for (const page of pages) {
  await build({
    configFile: false,
    root: resolve(ui, page),
    base: './',
    logLevel: 'warn',
    plugins: [react()],
    build: {
      outDir: resolve(ui, 'build', page),
      emptyOutDir: true,
      assetsDir: 'assets',
      chunkSizeWarningLimit: 400,
    },
  });

  const html = readFileSync(resolve(ui, 'build', page, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  const bad = refs.filter((r) => r.startsWith('/') || r.startsWith('..'));
  if (bad.length) {
    throw new Error(`${page}: non-relative asset paths ${bad.join(', ')}`);
  }
  const files = readdirSync(resolve(ui, 'build', page), { recursive: true });
  console.log(`built ${page}: ${files.join(', ')}`);
}
