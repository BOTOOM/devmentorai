import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts'],
    },
  },
  resolve: {
    alias: {
      '@devmentorai/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
});
