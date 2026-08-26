import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useMobileApp } from '../../src/application/mobile-app-provider';
import {
  getHouseholdCapabilities,
  getInvitationStatusLabel,
} from '../../src/application/mobile-app-view-model';
import {
  AppButton,
  AppCard,
  AppScreen,
  EmptyState,
  FeedbackCard,
  IconButton,
  ListRow,
  ScreenHeader,
  SectionHeader,
  StatusPill,
} from '../../src/ui/components';
import { colors, fontFamilies, spacing } from '../../src/ui/theme';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export default function HouseholdScreen() {
  const {
    households,
    invitations,
    refreshHouseholdContext,
    refreshHouseholds,
    revokeInvitation,
    selectedHousehold,
    selectHousehold,
  } = useMobileApp();
  const capabilities = getHouseholdCapabilities(selectedHousehold);
  const loadingHouseholds = households.status === 'loading';
  const loadingContext = invitations.status === 'loading';

  return (
    <AppScreen>
      <ScreenHeader
        action={
          <IconButton
            accessibilityLabel="Crear un hogar"
            icon="add"
            onPress={() => router.push('/households/create')}
          />
        }
        description="Elige el hogar con el que estás trabajando y administra su acceso."
        eyebrow="Fase 2 · Hogares"
        title="Tu hogar"
      />

      <View style={styles.section}>
        <SectionHeader
          action={loadingHouseholds ? <ActivityIndicator color={colors.accentCyan} /> : undefined}
          description={`${households.households.length} ${households.households.length === 1 ? 'hogar autorizado' : 'hogares autorizados'}`}
          title="Tus hogares"
        />

        {households.status === 'error' ? (
          <View style={styles.feedbackStack}>
            <FeedbackCard
              message={households.message}
              title="No pudimos actualizar tus hogares"
              tone="danger"
            />
            <AppButton label="Volver a intentar" onPress={refreshHouseholds} variant="secondary" />
          </View>
        ) : null}

        {loadingHouseholds ? (
          <AppCard style={styles.loadingCard}>
            <ActivityIndicator color={colors.accentCyan} />
            <Text style={styles.mutedText}>Consultando tus hogares…</Text>
          </AppCard>
        ) : null}

        {households.status === 'empty' ? (
          <View style={styles.feedbackStack}>
            <EmptyState
              description="Crea el primero o acepta una invitación que recibiste."
              icon="home-outline"
              title="Aún no tienes un hogar"
            />
            <AppButton
              icon="add-circle-outline"
              label="Crear un hogar"
              onPress={() => router.push('/households/create')}
            />
          </View>
        ) : null}

        <View style={styles.list}>
          {households.households.map((household) => {
            const selected = household.id === households.selectedHouseholdId;

            return (
              <ListRow
                caption={household.role === 'owner' ? 'Propietario' : 'Integrante'}
                icon={household.role === 'owner' ? 'shield-checkmark-outline' : 'people-outline'}
                key={household.id}
                onPress={() => void selectHousehold(household.id)}
                selected={selected}
                title={household.name}
                trailing={
                  selected ? (
                    <StatusPill label="Activo" tone="success" />
                  ) : (
                    <StatusPill label="Elegir" />
                  )
                }
              />
            );
          })}
        </View>

        {households.status !== 'empty' && !loadingHouseholds ? (
          <View style={styles.inlineActions}>
            <AppButton
              icon="add-outline"
              label="Crear otro hogar"
              onPress={() => router.push('/households/create')}
              variant="secondary"
            />
            <AppButton
              icon="key-outline"
              label="Aceptar una invitación"
              onPress={() => router.push('/invitations/accept')}
              variant="ghost"
            />
          </View>
        ) : null}
      </View>

      {selectedHousehold === undefined ? null : (
        <>
          <View style={styles.section}>
            <SectionHeader
              action={loadingContext ? <ActivityIndicator color={colors.accentCyan} /> : undefined}
              description={`${selectedHousehold.name} · ${capabilities.roleLabel}`}
              title="Integrantes"
            />

            {invitations.status === 'error' ? (
              <View style={styles.feedbackStack}>
                <FeedbackCard
                  message={invitations.message}
                  title="No pudimos actualizar este hogar"
                  tone="danger"
                />
                <AppButton
                  label="Volver a intentar"
                  onPress={refreshHouseholdContext}
                  variant="secondary"
                />
              </View>
            ) : null}

            <View style={styles.list}>
              {invitations.members.map((member, index) => (
                <ListRow
                  caption={member.role === 'owner' ? 'Propietario' : 'Integrante'}
                  icon={member.isCurrentUser ? 'person-circle-outline' : 'person-outline'}
                  key={`${member.role}-${index}`}
                  title={member.isCurrentUser ? 'Tú' : 'Integrante del hogar'}
                  trailing={
                    member.isCurrentUser ? (
                      <StatusPill label="Tu cuenta" tone="success" />
                    ) : undefined
                  }
                />
              ))}
            </View>
          </View>

          {capabilities.canManageInvitations ? (
            <View style={styles.section}>
              <SectionHeader
                action={
                  <IconButton
                    accessibilityLabel="Crear una invitación"
                    icon="person-add-outline"
                    onPress={() => router.push('/households/invite')}
                  />
                }
                description="Solo el Owner puede crear o revocar accesos."
                title="Invitaciones"
              />

              {invitations.invitations.length === 0 && !loadingContext ? (
                <EmptyState
                  description="Cuando invites a tu pareja, podrás consultar aquí su estado sin volver a ver el código secreto."
                  icon="mail-unread-outline"
                  title="No hay invitaciones"
                />
              ) : null}

              <View style={styles.list}>
                {invitations.invitations.map((invitation) => (
                  <AppCard key={invitation.id} style={styles.invitationCard}>
                    <View style={styles.invitationHeading}>
                      <View style={styles.invitationCopy}>
                        <Text style={styles.invitationEmail}>{invitation.targetEmailHint}</Text>
                        <Text style={styles.mutedText}>
                          Vence el {formatDate(invitation.expiresAt)}
                        </Text>
                      </View>
                      <StatusPill
                        label={getInvitationStatusLabel(invitation.status)}
                        tone={invitation.status === 'accepted' ? 'success' : 'neutral'}
                      />
                    </View>
                    {invitation.status === 'pending' ? (
                      <AppButton
                        disabled={invitations.status === 'revoking'}
                        icon="close-circle-outline"
                        label={invitations.status === 'revoking' ? 'Revocando…' : 'Revocar'}
                        onPress={() => revokeInvitation(invitation.id)}
                        variant="danger"
                      />
                    ) : null}
                  </AppCard>
                ))}
              </View>

              <AppButton
                icon="person-add-outline"
                label="Crear una invitación"
                onPress={() => router.push('/households/invite')}
              />
            </View>
          ) : null}
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  feedbackStack: {
    gap: spacing.sm,
  },
  inlineActions: {
    gap: spacing.sm,
  },
  invitationCard: {
    gap: spacing.md,
    padding: spacing.md,
  },
  invitationCopy: {
    flex: 1,
    gap: 4,
  },
  invitationEmail: {
    color: colors.text,
    fontFamily: fontFamilies.semibold,
    fontSize: 15,
  },
  invitationHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  list: {
    gap: spacing.sm,
  },
  loadingCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  mutedText: {
    color: colors.textMuted,
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  section: {
    gap: spacing.md,
  },
});
