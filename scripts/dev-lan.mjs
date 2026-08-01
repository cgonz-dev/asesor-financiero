import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { createServer } from 'node:net';

const API_PORT = 3000;
const WEB_PORT = 8081;
const LOOPBACK_ORIGINS = ['http://localhost:8081', 'http://127.0.0.1:8081'];
const PRIVATE_INTERFACE_NAME =
  /bluetooth|docker|hyper-v|loopback|tunnel|vbox|vethernet|virtual|vmware|wsl/i;
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const children = [];
let isStopping = false;

function write(message) {
  process.stdout.write(`${message}\n`);
}

function isPrivateIpv4(address) {
  const octets = address.split('.').map(Number);

  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false;
  }

  return (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

function findLanIp() {
  const requestedIp = process.env.LAN_IP?.trim();

  if (requestedIp !== undefined && requestedIp.length > 0) {
    if (!isPrivateIpv4(requestedIp)) {
      throw new Error(
        'LAN_IP must be an active private IPv4 address, such as 192.168.x.x or 10.x.x.x.',
      );
    }

    return requestedIp;
  }

  const candidates = Object.entries(networkInterfaces()).flatMap(([name, addresses]) => {
    if (PRIVATE_INTERFACE_NAME.test(name)) {
      return [];
    }

    return (addresses ?? [])
      .filter((address) => address.family === 'IPv4' && !address.internal)
      .map((address) => ({ address: address.address, name }))
      .filter(({ address }) => isPrivateIpv4(address));
  });

  if (candidates.length === 0) {
    throw new Error(
      'No private IPv4 address was detected. Connect to Wi-Fi or set LAN_IP to the private IPv4 to use.',
    );
  }

  if (candidates.length > 1) {
    write(
      `Multiple private IPv4 addresses found. Using ${candidates[0].address} (${candidates[0].name}).`,
    );
    write('Set LAN_IP to choose a different private IPv4 address.');
  }

  return candidates[0].address;
}

function assertPortIsAvailable(port) {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.once('error', () => {
      reject(
        new Error(
          `Port ${port} is already in use. Stop the process using it before running pnpm dev:lan.`,
        ),
      );
    });
    server.listen(port, '127.0.0.1', () => {
      server.close((error) => {
        if (error === undefined) {
          resolve();
          return;
        }

        reject(error);
      });
    });
  });
}

function run(command, args, environment) {
  return spawn(command, args, {
    cwd: process.cwd(),
    env: environment,
    shell: process.platform === 'win32',
    stdio: 'inherit',
    windowsHide: false,
  });
}

function runToCompletion(command, args) {
  return new Promise((resolve, reject) => {
    const child = run(command, args, process.env);

    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}.`));
    });
  });
}

async function waitForHttp(url, label) {
  const timeoutAt = Date.now() + 30_000;

  while (Date.now() < timeoutAt) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });

      if (response.ok) {
        return;
      }
    } catch {
      // The process is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`${label} did not become available at ${url} within 30 seconds.`);
}

function terminateChild(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.pid === undefined) {
      resolve();
      return;
    }

    const done = () => resolve();
    const timer = setTimeout(done, 5_000);
    timer.unref();
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });

    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', `${child.pid}`, '/t', '/f'], {
        stdio: 'ignore',
        windowsHide: true,
      }).once('error', done);
      return;
    }

    child.kill('SIGTERM');
  });
}

async function stopChildren() {
  if (isStopping) {
    return;
  }

  isStopping = true;
  await Promise.all(children.map(terminateChild));
}

function handleChildExit(child, label) {
  child.once('exit', (code, signal) => {
    if (isStopping) {
      return;
    }

    console.error(`${label} stopped unexpectedly (${signal ?? `exit code ${code ?? 'unknown'}`}).`);
    void stopChildren().finally(() => {
      process.exitCode = code === 0 ? 1 : (code ?? 1);
    });
  });
}

async function startLanDevelopment() {
  const lanIp = findLanIp();
  const appUrl = `http://${lanIp}:${WEB_PORT}`;
  const healthUrl = `http://${lanIp}:${API_PORT}/api/v1/health`;
  const corsOrigins = [...LOOPBACK_ORIGINS, appUrl].join(',');

  await Promise.all([assertPortIsAvailable(API_PORT), assertPortIsAvailable(WEB_PORT)]);
  await runToCompletion(pnpmCommand, ['--filter', '@copiloto/contracts', 'build']);

  const api = run(pnpmCommand, ['--filter', '@copiloto/api', 'dev'], {
    ...process.env,
    API_HOST: '0.0.0.0',
    CORS_ALLOWED_ORIGINS: corsOrigins,
  });
  const mobile = run(
    pnpmCommand,
    ['--filter', '@copiloto/mobile', 'exec', 'expo', 'start', '--web', '--lan'],
    {
      ...process.env,
      EXPO_PUBLIC_API_URL: `http://${lanIp}:${API_PORT}`,
    },
  );

  children.push(api, mobile);
  handleChildExit(api, 'API');
  handleChildExit(mobile, 'Expo Web');

  await Promise.all([waitForHttp(healthUrl, 'API'), waitForHttp(appUrl, 'Expo Web')]);

  write('');
  write('Copiloto Financiero is ready on the local network.');
  write(`IPv4: ${lanIp}`);
  write(`App: ${appUrl}`);
  write(`Health: ${healthUrl}`);
  write(`Local app: http://localhost:${WEB_PORT}`);
  write(`Local health: http://localhost:${API_PORT}/api/v1/health`);
  write('Press Ctrl+C to stop the API and Expo Web.');
}

async function main() {
  process.once('SIGINT', () => {
    write('\nStopping LAN development servers...');
    void stopChildren();
  });
  process.once('SIGTERM', () => {
    void stopChildren();
  });

  await startLanDevelopment();
}

void main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await stopChildren();
  process.exitCode = 1;
});
