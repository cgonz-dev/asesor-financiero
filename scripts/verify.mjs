import { spawnSync } from 'node:child_process';

const FULL_FLAG = '--full';
const argumentsProvided = process.argv.slice(2);
const unexpectedArguments = argumentsProvided.filter((argument) => argument !== FULL_FLAG);

if (unexpectedArguments.length > 0) {
  process.stderr.write(`Unknown verification argument: ${unexpectedArguments.join(', ')}\n`);
  process.exit(2);
}

const full = argumentsProvided.includes(FULL_FLAG);

const databaseChecks = [
  ['Generate Prisma Client', 'pnpm', ['db:generate']],
  ['Apply versioned migrations', 'pnpm', ['db:migrate:deploy']],
  ['Check migration status', 'pnpm', ['db:status']],
];

const baselineChecks = [
  ['Lint', 'pnpm', ['lint']],
  ['Check formatting', 'pnpm', ['format:check']],
  ['Type check', 'pnpm', ['typecheck']],
];

const testChecks = full
  ? [
      ['Run all tests', 'pnpm', ['test']],
      ['Run unit tests', 'pnpm', ['test:unit']],
      ['Run integration tests', 'pnpm', ['test:integration']],
      ['Run end-to-end tests', 'pnpm', ['test:e2e']],
    ]
  : [['Run unit tests', 'pnpm', ['test:unit']]];

const artifactChecks = [
  ['Build workspaces', 'pnpm', ['build']],
  ['Check OpenAPI', 'pnpm', ['openapi:check']],
  ['Check peer dependencies', 'pnpm', ['peers', 'check']],
  ['Run Expo Doctor', 'pnpm', ['expo:doctor']],
  ['Check diff whitespace', 'git', ['diff', '--check']],
];

const checks = [
  ...(full ? databaseChecks : []),
  ...baselineChecks,
  ...testChecks,
  ...artifactChecks,
];

function runCommand(command, commandArguments) {
  if (process.platform === 'win32' && command === 'pnpm') {
    return spawnSync(
      process.env.ComSpec ?? 'cmd.exe',
      ['/d', '/s', '/c', 'pnpm', ...commandArguments],
      {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'inherit',
        windowsHide: true,
      },
    );
  }

  return spawnSync(command, commandArguments, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  });
}

for (const [label, command, commandArguments] of checks) {
  process.stdout.write(`\n==> ${label}\n`);
  const result = runCommand(command, commandArguments);

  if (result.error !== undefined) {
    process.stderr.write(`${result.error.message}\n`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

process.stdout.write(`\nVerification passed (${full ? 'full' : 'baseline'}).\n`);
