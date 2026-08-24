import { baseConfig } from '@copiloto/eslint-config';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.expo/**',
      'apps/api/openapi/openapi.json',
      'apps/api/src/generated/prisma/**',
    ],
  },
  ...baseConfig,
];
