import type { SessionStatus } from '../auth/auth0-session-coordinator';

export const LOGIN_SCREEN_COPY = {
  brand: 'Copiloto Financiero',
  description: 'Organiza tu hogar y prepara un espacio compartido con una identidad segura.',
  securityDescription:
    'Google gestiona tu acceso en el navegador seguro. Copiloto Financiero nunca recibe tu contraseña.',
  securityTitle: 'Tu acceso sigue protegido',
  title: 'Empieza desde un lugar seguro',
} as const;

export const LOGIN_ACTIONS = [
  {
    id: 'google',
    label: 'Continuar con Google',
  },
] as const;

export interface LoginScreenFeedback {
  description: string;
  title: string;
  tone: 'danger' | 'neutral' | 'warning';
}

export interface LoginScreenModel {
  action: (typeof LOGIN_ACTIONS)[number];
  disabled: boolean;
  feedback?: LoginScreenFeedback;
  loading: boolean;
}

export function getLoginScreenModel(
  status: SessionStatus,
  authenticationAvailable: boolean,
  message?: string,
): LoginScreenModel {
  const loading = status === 'authenticating';
  let feedback: LoginScreenFeedback | undefined;

  if (!authenticationAvailable) {
    feedback = {
      description: 'Usa un development build móvil configurado para probar el acceso real.',
      title: 'Acceso móvil no disponible aquí',
      tone: 'warning',
    };
  } else if (loading) {
    feedback = {
      description: 'Completa el acceso en el navegador seguro. Volverás automáticamente a la app.',
      title: 'Abriendo Google…',
      tone: 'neutral',
    };
  } else if (status === 'error') {
    feedback = {
      description: message ?? 'No pudimos completar la autenticación de forma segura.',
      title: 'No pudimos iniciar tu sesión',
      tone: 'danger',
    };
  }

  const model: LoginScreenModel = {
    action: LOGIN_ACTIONS[0],
    disabled: !authenticationAvailable || loading,
    loading,
  };

  return feedback === undefined ? model : { ...model, feedback };
}
