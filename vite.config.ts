import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // vitest 4 makes the per-pixel expect loop in tests/textures.test.ts exceed the 5s default
    testTimeout: 30000,
    include: ['tests/**/*.test.ts', 'src/__tests__/**/*.test.ts']
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 2000
  }
});
