import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Dev server config (npm run dev): serves all four pages from one server.
// Production builds go through scripts/build.mjs, which runs one Vite build
// per page so every Forge resource folder is self-contained.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'build',
    rollupOptions: {
      input: {
        panel: resolve(import.meta.dirname, 'panel/index.html'),
        glance: resolve(import.meta.dirname, 'glance/index.html'),
        admin: resolve(import.meta.dirname, 'admin/index.html'),
        overview: resolve(import.meta.dirname, 'overview/index.html'),
      },
    },
  },
});
