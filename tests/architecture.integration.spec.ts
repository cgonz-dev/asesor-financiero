import { readdir, readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workspaceRoot = resolve(import.meta.dirname, '..');
const sourceExtensions = new Set(['.ts', '.tsx']);

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);

      if (entry.isDirectory()) {
        return sourceFiles(path);
      }

      return sourceExtensions.has(extname(entry.name)) ? [path] : [];
    }),
  );

  return nestedFiles.flat();
}

async function sourceText(relativeDirectory: string): Promise<string> {
  const files = await sourceFiles(resolve(workspaceRoot, relativeDirectory));
  const contents = await Promise.all(files.map((file) => readFile(file, 'utf8')));

  return contents.join('\n');
}

describe('architecture boundaries', () => {
  it('keeps contracts independent from application frameworks', async () => {
    const contents = await sourceText('packages/contracts/src');

    expect(contents).not.toMatch(
      /@nestjs\/|@prisma\/|expo(?:\/|['"])|openai|react-native|apps[\\/]api/i,
    );
  });

  it('keeps domain independent from frameworks and infrastructure adapters', async () => {
    const packageJson = await readFile(
      resolve(workspaceRoot, 'packages/domain/package.json'),
      'utf8',
    );
    const contents = await sourceText('packages/domain/src');

    expect(packageJson).not.toMatch(/@nestjs\/|@prisma\/|["']expo(?:\/|["'])|openai|react-native/i);
    expect(contents).not.toMatch(
      /@nestjs\/|@prisma\/|["']expo(?:\/|["'])|openai|react-native|apps[\\/]api/i,
    );
  });

  it('prevents mobile from importing API internals', async () => {
    const contents = [
      await sourceText('apps/mobile/app'),
      await sourceText('apps/mobile/src'),
    ].join('\n');

    expect(contents).not.toMatch(
      /apps[\\/]api|@copiloto\/api|\.\.[\\/]\.\.[\\/]api|@prisma\/|generated[\\/]prisma|persistence/i,
    );
  });

  it('keeps API response shapes in the shared contracts package', async () => {
    const contents = await sourceText('apps/api/src');

    expect(contents).toContain("from '@copiloto/contracts'");
    expect(contents).not.toMatch(/\bz\.(?:object|strictObject|looseObject)\s*\(/);
  });
});
