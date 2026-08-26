import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { useMobileApp } from '../../src/application/mobile-app-provider';
import {
  AppButton,
  AppCard,
  AppScreen,
  BrandMark,
  FeedbackCard,
  ScreenHeader,
  StatusPill,
} from '../../src/ui/components';
import { colors, fontFamilies, spacing } from '../../src/ui/theme';

export default function ProfileScreen() {
  const { logout, refreshProfile, session } = useMobileApp();
  const refreshing = session.profileRefreshStatus === 'refreshing';

  return (
    <AppScreen>
      <ScreenHeader
        action={<BrandMark size={48} />}
        description="Revisa la identidad interna que la API asocia con tu sesión."
        eyebrow="Fase 2 · Identidad"
        title="Tu perfil"
      />

      <AppCard style={styles.profileCard}>
        <View style={styles.profileTop}>
          <View style={styles.avatar}>
            <Ionicons color={colors.text} name="person" size={34} />
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.profileTitle}>Cuenta de Copiloto Financiero</Text>
            <Text style={styles.profileSubtitle}>Identidad verificada por el servidor</Text>
          </View>
          <StatusPill label="Activa" tone="success" />
        </View>

        <View style={styles.identifierBlock}>
          <Text style={styles.identifierLabel}>Identificador interno</Text>
          <Text selectable style={styles.identifierValue}>
            {session.profile?.id ?? 'No disponible'}
          </Text>
        </View>
      </AppCard>

      {session.profileRefreshStatus === 'succeeded' ? (
        <FeedbackCard
          message="La API confirmó que tu sesión y perfil siguen vigentes."
          title="Perfil consultado correctamente"
          tone="success"
        />
      ) : null}

      <View style={styles.actions}>
        <AppButton
          icon="refresh-outline"
          label={refreshing ? 'Consultando perfil…' : 'Consultar mi perfil'}
          loading={refreshing}
          onPress={refreshProfile}
        />
        <AppButton icon="log-out-outline" label="Cerrar sesión" onPress={logout} variant="danger" />
      </View>

      <Text style={styles.securityNote}>
        Al cerrar sesión se cancelan las solicitudes activas y se limpia el estado sensible de la
        aplicación.
      </Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.sm,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 24,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  identifierBlock: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 18,
    gap: 6,
    padding: spacing.md,
  },
  identifierLabel: {
    color: colors.textMuted,
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  identifierValue: {
    color: colors.text,
    fontFamily: fontFamilies.medium,
    fontSize: 13,
    lineHeight: 20,
  },
  profileCard: {
    gap: spacing.lg,
  },
  profileCopy: {
    flex: 1,
    gap: 4,
  },
  profileSubtitle: {
    color: colors.textMuted,
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  profileTitle: {
    color: colors.text,
    fontFamily: fontFamilies.semibold,
    fontSize: 16,
    lineHeight: 22,
  },
  profileTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  securityNote: {
    color: colors.textSubtle,
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: spacing.md,
    textAlign: 'center',
  },
});
