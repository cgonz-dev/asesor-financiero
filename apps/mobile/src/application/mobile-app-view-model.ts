import type { HouseholdInvitationStatus, HouseholdSummary } from '@copiloto/contracts';

import type { SessionStatus } from '../auth/auth0-session-coordinator';

export interface HouseholdCapabilities {
  canManageInvitations: boolean;
  roleLabel: 'Integrante' | 'Propietario' | undefined;
}

export interface SessionPresentation {
  description: string;
  title: string;
  tone: 'danger' | 'neutral' | 'success' | 'warning';
}

export function getHouseholdCapabilities(
  household: HouseholdSummary | undefined,
): HouseholdCapabilities {
  if (household === undefined) {
    return { canManageInvitations: false, roleLabel: undefined };
  }

  return household.role === 'owner'
    ? { canManageInvitations: true, roleLabel: 'Propietario' }
    : { canManageInvitations: false, roleLabel: 'Integrante' };
}

export function getInvitationStatusLabel(status: HouseholdInvitationStatus): string {
  const labels: Record<HouseholdInvitationStatus, string> = {
    accepted: 'Aceptada',
    expired: 'Expirada',
    pending: 'Pendiente',
    revoked: 'Revocada',
  };

  return labels[status];
}

export function getSessionPresentation(
  status: SessionStatus,
  message?: string,
): SessionPresentation {
  switch (status) {
    case 'authenticated':
      return {
        description: 'Tu identidad fue validada por la API.',
        title: 'Sesión protegida',
        tone: 'success',
      };
    case 'authenticating':
      return {
        description: 'Completa el acceso en el navegador seguro.',
        title: 'Conectando con Auth0…',
        tone: 'neutral',
      };
    case 'error':
      return {
        description: message ?? 'No pudimos validar la sesión.',
        title: 'La sesión necesita atención',
        tone: 'danger',
      };
    case 'restoring':
      return {
        description: 'Validando las credenciales guardadas de forma segura.',
        title: 'Restaurando tu sesión…',
        tone: 'neutral',
      };
    case 'unauthenticated':
      return {
        description: 'Inicia sesión para continuar con la configuración de tus hogares.',
        title: 'Tu espacio financiero, protegido',
        tone: 'warning',
      };
  }
}
