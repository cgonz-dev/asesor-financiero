import 'reflect-metadata';

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { createApplication } from '../create-application';
import { canonicalJson } from '../openapi/canonical-json';
import { createOpenApiDocument } from '../openapi/create-openapi-document';

type Command = 'check' | 'generate';

async function buildOpenApiArtifact(): Promise<string> {
  const app = await createApplication({ docs: false });

  try {
    await app.init();
    return canonicalJson(createOpenApiDocument(app));
  } finally {
    await app.close();
  }
}

async function run(command: Command): Promise<void> {
  const outputDirectory = resolve(process.cwd(), 'openapi');
  const outputPath = resolve(outputDirectory, 'openapi.json');
  const generated = await buildOpenApiArtifact();

  if (command === 'generate') {
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(outputPath, generated, 'utf8');
    return;
  }

  const existing = await readFile(outputPath, 'utf8');

  if (existing !== generated) {
    throw new Error(
      'The committed OpenAPI artifact is stale. Run pnpm openapi:generate and review the change.',
    );
  }
}

const command = process.argv[2];

if (command !== 'generate' && command !== 'check') {
  throw new Error('Expected one command: generate or check.');
}

void run(command);
