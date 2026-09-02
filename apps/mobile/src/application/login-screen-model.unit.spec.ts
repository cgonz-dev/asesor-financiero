import { describe, expect, it } from 'vitest';

import { getLoginScreenModel, LOGIN_ACTIONS, LOGIN_SCREEN_COPY } from './login-screen-model';

describe('Google-only login presentation', () => {
  it('expone exactamente una acción de acceso y es Google', () => {
    expect(LOGIN_ACTIONS).toEqual([{ id: 'google', label: 'Continuar con Google' }]);
    expect(LOGIN_ACTIONS).toHaveLength(1);
    expect(LOGIN_ACTIONS.map(({ id }) => id)).not.toContain('apple');
    expect(LOGIN_ACTIONS.map(({ id }) => id)).not.toContain('password');
    expect(LOGIN_ACTIONS.map(({ id }) => id)).not.toContain('email');
  });

  it('explica que la app no recibe la contraseña de Google', () => {
    expect(LOGIN_SCREEN_COPY.securityDescription).toContain('nunca recibe tu contraseña');
    expect(LOGIN_SCREEN_COPY.securityDescription).toContain('Google');
  });

  it('bloquea la acción mientras el navegador seguro está autenticando', () => {
    expect(getLoginScreenModel('authenticating', true)).toMatchObject({
      action: { id: 'google', label: 'Continuar con Google' },
      disabled: true,
      feedback: {
        description: expect.stringContaining('navegador seguro'),
        title: 'Abriendo Google…',
      },
      loading: true,
    });
  });

  it('mantiene los errores públicos y permite reintentar', () => {
    expect(
      getLoginScreenModel('error', true, 'No pudimos validar la sesión por un problema de red.'),
    ).toMatchObject({
      disabled: false,
      feedback: {
        description: 'No pudimos validar la sesión por un problema de red.',
        tone: 'danger',
      },
      loading: false,
    });
  });
});
