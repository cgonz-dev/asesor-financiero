import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const mode = process.argv[2];
if (!['direct', 'pooler'].includes(mode)) {
  process.stderr.write('Usage: node scripts/run-rls-spike.mjs <direct|pooler>\n');
  process.exit(2);
}

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const composeFile = path.join(workspaceRoot, 'apps', 'api', 'test', 'rls', 'docker', 'compose.yml');
const projectName = `copiloto-rls-spike-${process.pid}`;
const pnpmEntrypoint = process.env.npm_execpath;

function randomSecret() {
  return randomBytes(32).toString('base64url');
}

function run(command, argumentsProvided, options = {}) {
  const result = spawnSync(command, argumentsProvided, {
    cwd: workspaceRoot,
    env: options.env ?? process.env,
    stdio: options.stdio ?? 'inherit',
    timeout: options.timeout,
    windowsHide: true,
  });

  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status ?? 'unknown'}.`);
  }

  return result;
}

function compose(argumentsProvided, environment, stdio = 'inherit') {
  return run(
    'docker',
    ['compose', '--project-name', projectName, '--file', composeFile, ...argumentsProvided],
    { env: environment, stdio },
  );
}

function pnpm(argumentsProvided, options = {}) {
  if (pnpmEntrypoint !== undefined && pnpmEntrypoint.length > 0) {
    return run(process.execPath, [pnpmEntrypoint, ...argumentsProvided], options);
  }

  return run('pnpm', argumentsProvided, options);
}

async function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        server.close();
        reject(new Error('Could not allocate a loopback port for the RLS spike.'));
        return;
      }
      server.close((error) => {
        if (error !== undefined) reject(error);
        else resolve(address.port);
      });
    });
  });
}

async function waitForPostgres(environment) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = spawnSync(
      'docker',
      [
        'compose',
        '--project-name',
        projectName,
        '--file',
        composeFile,
        'exec',
        '-T',
        'postgres',
        'pg_isready',
        '-U',
        'rls_spike_admin',
        '-d',
        'copiloto_rls_spike',
      ],
      { cwd: workspaceRoot, env: environment, stdio: 'ignore', windowsHide: true },
    );
    if (result.status === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error('Disposable PostgreSQL did not become ready within 60 seconds.');
}

async function waitForTcp(port) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const connected = await new Promise((resolve) => {
      const socket = net.createConnection({ host: '127.0.0.1', port });
      socket.setTimeout(500);
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('error', () => resolve(false));
      socket.once('timeout', () => {
        socket.destroy();
        resolve(false);
      });
    });
    if (connected) return;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error('PgBouncer did not listen within 60 seconds.');
}

const postgresPort = await availablePort();
let pgbouncerPort = await availablePort();
while (pgbouncerPort === postgresPort) {
  pgbouncerPort = await availablePort();
}
const adminPassword = randomSecret();
const appPassword = randomSecret();
const jobPassword = randomSecret();
const composeEnvironment = {
  ...process.env,
  RLS_SPIKE_ADMIN_PASSWORD: adminPassword,
  RLS_SPIKE_APP_PASSWORD: appPassword,
  RLS_SPIKE_PGBOUNCER_PORT: String(pgbouncerPort),
  RLS_SPIKE_POSTGRES_PORT: String(postgresPort),
};
const adminDatabaseUrl = `postgresql://rls_spike_admin:${encodeURIComponent(adminPassword)}@127.0.0.1:${postgresPort}/copiloto_rls_spike`;
const testEnvironment = {
  ...process.env,
  DATABASE_URL: adminDatabaseUrl,
  RLS_SPIKE_ADMIN_DATABASE_URL: adminDatabaseUrl,
  RLS_SPIKE_APP_PASSWORD: appPassword,
  RLS_SPIKE_CONTAINER: 'true',
  RLS_SPIKE_JOB_PASSWORD: jobPassword,
  ...(mode === 'pooler'
    ? {
        RLS_SPIKE_APP_DATABASE_URL: `postgresql://rls_spike_app:${encodeURIComponent(appPassword)}@127.0.0.1:${pgbouncerPort}/copiloto_rls_spike`,
      }
    : {}),
};

let composeStarted = false;

try {
  run('docker', ['version'], { stdio: 'ignore', timeout: 10_000 });
  composeStarted = true;
  compose(
    mode === 'pooler'
      ? ['up', '--detach', '--build', 'postgres', 'pgbouncer']
      : ['up', '--detach', 'postgres'],
    composeEnvironment,
  );
  await waitForPostgres(composeEnvironment);
  if (mode === 'pooler') {
    await waitForTcp(pgbouncerPort);
    compose(['exec', '-T', 'pgbouncer', 'pgbouncer', '--version'], composeEnvironment);
  }

  pnpm(['db:migrate:deploy'], { env: testEnvironment });
  pnpm(['db:status'], { env: testEnvironment });
  pnpm(['db:generate'], { env: testEnvironment });
  pnpm(
    [
      'exec',
      'vitest',
      'run',
      '--config',
      'vitest.rls.config.ts',
      ...(mode === 'pooler'
        ? [
            'apps/api/test/rls-pooler.integration.spec.ts',
            'apps/api/test/rls-membership-revocation-pooler.integration.spec.ts',
          ]
        : [
            'apps/api/test/rls-direct.integration.spec.ts',
            'apps/api/test/rls-membership-revocation-direct.integration.spec.ts',
          ]),
    ],
    { env: testEnvironment },
  );
} finally {
  if (composeStarted) {
    try {
      compose(['down', '--volumes', '--remove-orphans', '--rmi', 'local'], composeEnvironment);
    } catch (error) {
      process.stderr.write(`RLS spike cleanup failed: ${String(error)}\n`);
    }
  }
}
