import { describe, expect, it } from 'vitest';

import {
  getHouseholdCapabilities,
  getInvitationStatusLabel,
  getSessionPresentation,
} from './mobile-app-view-model';

describe('mobile app view model', () => {
  it('solo ofrece administración de invitaciones al Owner', () => {
    expect(
      getHouseholdCapabilities({
        id: '22222222-2222-4222-8222-222222222222',
        membershipStatus: 'active',
        name: 'Casa',
        role: 'owner',
      }),
    ).toEqual({ canManageInvitations: true, roleLabel: 'Propietario' });

    expect(
      getHouseholdCapabilities({
        id: '33333333-3333-4333-8333-333333333333',
        membershipStatus: 'active',
        name: 'Casa compartida',
        role: 'member',
      }),
    ).toEqual({ canManageInvitations: false, roleLabel: 'Integrante' });

    expect(getHouseholdCapabilities(undefined)).toEqual({
      canManageInvitations: false,
      roleLabel: undefined,
    });
  });

  it('presenta estados públicos y localizados para la sesión', () => {
    expect(getSessionPresentation('authenticated').tone).toBe('success');
    expect(getSessionPresentation('restoring').title).toContain('Restaurando');
    expect(getSessionPresentation('error', 'Sin conexión.')).toMatchObject({
      description: 'Sin conexión.',
      tone: 'danger',
    });
  });

  it('traduce todos los estados de una invitación', () => {
    expect(getInvitationStatusLabel('pending')).toBe('Pendiente');
    expect(getInvitationStatusLabel('accepted')).toBe('Aceptada');
    expect(getInvitationStatusLabel('expired')).toBe('Expirada');
    expect(getInvitationStatusLabel('revoked')).toBe('Revocada');
  });
});
