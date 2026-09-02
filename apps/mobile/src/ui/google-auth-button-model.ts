export interface GoogleAuthButtonState {
  accessibilityState: {
    busy: boolean;
    disabled: boolean;
  };
  blocked: boolean;
}

export function getGoogleAuthButtonState(
  disabled: boolean,
  loading: boolean,
): GoogleAuthButtonState {
  const blocked = disabled || loading;

  return {
    accessibilityState: { busy: loading, disabled: blocked },
    blocked,
  };
}

export function createSingleFlightAction(
  action: () => void | Promise<void>,
): () => Promise<boolean> {
  let inFlight = false;

  return async () => {
    if (inFlight) {
      return false;
    }

    inFlight = true;

    try {
      await action();
      return true;
    } finally {
      inFlight = false;
    }
  };
}
