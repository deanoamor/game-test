import { defineConfig } from 'vite';

// The core GLB assets live in ./assets/core (places/*.glb, characters/*.glb) and are served from the site root.
export default defineConfig({
  base: './',
  publicDir: 'assets/core',
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
} as import('vite').UserConfig);
