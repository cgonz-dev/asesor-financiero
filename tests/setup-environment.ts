import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';

try {
  loadEnvFile(resolve(import.meta.dirname, '..', 'apps', 'api', '.env'));
} catch (error: unknown) {
  if (
    error === null ||
    typeof error !== 'object' ||
    !('code' in error) ||
    error.code !== 'ENOENT'
  ) {
    throw error;
  }
}
