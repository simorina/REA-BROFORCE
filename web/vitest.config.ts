import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts: Vitest 2 ships its own Vite 5 types, which don't accept Vite 6 plugins.
export default defineConfig({
  test: { environment: 'node' },
});
