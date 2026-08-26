import { describe, expect, it } from 'vitest';

import { normalizeNativeIntentPath } from '../../app/+native-intent';

describe('normalizeNativeIntentPath', () => {
  it.each([
    'copilotofinanciero:',
    'copilotofinanciero://',
    'copilotofinanciero:///',
    'COPILOTOFINANCIERO:///',
  ])('maps the native application root %s to the router root', (path) => {
    expect(normalizeNativeIntentPath(path)).toBe('/');
  });

  it('preserves non-root native paths', () => {
    const callback =
      'copilotofinanciero://tenant.auth0.com/android/com.copilotofinanciero.dev/callback';

    expect(normalizeNativeIntentPath(callback)).toBe(callback);
  });

  it('preserves internal router paths', () => {
    expect(normalizeNativeIntentPath('/households/create')).toBe('/households/create');
  });
});
