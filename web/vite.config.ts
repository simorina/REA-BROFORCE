import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// game-data/ (extracted locally, never committed) is served as the site root.
export default defineConfig({
  plugins: [react()],
  publicDir: '../game-data',
});
