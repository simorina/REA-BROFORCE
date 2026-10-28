import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // game-data/ (extracted locally, never committed or published) is the dev server's site root. A build never takes it
  // in, so a deployed site carries none of Broforce's assets: its players load their own into the browser, and the
  // service worker built here as /sw.js serves them (src/app/gameDataStore.ts, src/sw.ts).
  publicDir: command === 'serve' ? '../game-data' : false,
  build: {
    rollupOptions: {
      input: { main: 'index.html', sw: 'src/sw.ts' }, // from web/, where the build runs
      output: { entryFileNames: (chunk) => (chunk.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js') },
    },
  },
}));
