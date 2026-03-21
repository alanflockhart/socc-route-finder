import { defineConfig } from 'vite';

export default defineConfig({
  // Base path for GitHub Pages deployment
  base: '/socc-route-finder/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    open: true
  },
  test: {
    exclude: ['e2e/**', 'node_modules/**'],
  }
});
