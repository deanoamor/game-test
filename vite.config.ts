import { defineConfig } from 'vite';

// The GLB landmarks live in ./assets (core/places/*.glb) and are served from the site root.
export default defineConfig({
  base: './',
  publicDir: 'assets',
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
} as import('vite').UserConfig);
