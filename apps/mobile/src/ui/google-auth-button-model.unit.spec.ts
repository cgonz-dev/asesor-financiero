import { describe, expect, it, vi } from 'vitest';

import { createSingleFlightAction, getGoogleAuthButtonState } from './google-auth-button-model';

describe('GoogleAuthButton behavior', () => {
  it('impide un segundo envío aunque ocurra antes de que la pantalla cambie a loading', async () => {
    let resolveLogin: (() => void) | undefined;
    const pendingLogin = new Promise<void>((resolve) => {
      resolveLogin = resolve;
    });
    const action = vi.fn(() => pendingLogin);
    const run = createSingleFlightAction(action);

    const first = run();
    const second = run();

    await expect(second).resolves.toBe(false);
    expect(action).toHaveBeenCalledOnce();

    resolveLogin?.();
    await expect(first).resolves.toBe(true);
    await expect(run()).resolves.toBe(true);
    expect(action).toHaveBeenCalledTimes(2);
  });

  it('expone estado accesible ocupado y deshabilitado durante autenticación', () => {
    expect(getGoogleAuthButtonState(false, true)).toEqual({
      accessibilityState: { busy: true, disabled: true },
      blocked: true,
    });
    expect(getGoogleAuthButtonState(false, false)).toEqual({
      accessibilityState: { busy: false, disabled: false },
      blocked: false,
    });
  });
});
