const nativeRootUrls = new Set([
  'copilotofinanciero:',
  'copilotofinanciero://',
  'copilotofinanciero:///',
]);

export function normalizeNativeIntentPath(path: string): string {
  const normalizedPath = path.trim().toLowerCase();

  if (nativeRootUrls.has(normalizedPath)) {
    return '/';
  }

  return path;
}

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return normalizeNativeIntentPath(path);
  } catch {
    return '/';
  }
}
