import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@copiloto/contracts': fileURLToPath(
        new URL('./packages/contracts/src/index.ts', import.meta.url),
      ),
      '@copiloto/domain': fileURLToPath(new URL('./packages/domain/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: [
      'packages/contracts/test/**/*.unit.spec.ts',
      'packages/domain/test/**/*.unit.spec.ts',
      'apps/api/src/**/*.unit.spec.ts',
      'apps/api/test/**/*.unit.spec.ts',
      'apps/mobile/src/**/*.unit.spec.ts',
    ],
    setupFiles: ['./tests/setup-environment.ts'],
  },
});
