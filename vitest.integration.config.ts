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
    fileParallelism: false,
    include: ['tests/**/*.integration.spec.ts', 'apps/api/test/**/*.integration.spec.ts'],
    setupFiles: ['./tests/setup-environment.ts'],
  },
});
