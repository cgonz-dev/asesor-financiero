import { spawnSync } from 'node:child_process';

const command = process.platform === 'win32' ? 'cmd.exe' : 'pnpm';
const args =
  process.platform === 'win32'
    ? ['/d', '/s', '/c', 'pnpm dlx expo-doctor@1.20.4 apps/mobile']
    : ['dlx', 'expo-doctor@1.20.4', 'apps/mobile'];

const result = spawnSync(command, args, {
  cwd: process.cwd(),
  env: {
    ...process.env,
    // Validate against the compatibility map bundled with the installed Expo SDK.
    // This avoids registry patch releases changing a frozen-lockfile baseline.
    EXPO_OFFLINE: '1',
  },
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
