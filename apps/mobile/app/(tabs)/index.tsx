import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useMobileApp } from '../../src/application/mobile-app-provider';
import { getHouseholdCapabilities } from '../../src/application/mobile-app-view-model';
import {
  AppButton,
  AppCard,
  AppScreen,
  BrandMark,
  EmptyState,
  GradientCard,
  ListRow,
  ScreenHeader,
  SectionHeader,
  StatusPill,
} from '../../src/ui/components';
import { colors, fontFamilies, spacing } from '../../src/ui/theme';

export default function HomeScreen() {
  const { households, selectedHousehold, session } = useMobileApp();
  const capabilities = getHouseholdCapabilities(selectedHousehold);

  return (
    <AppScreen>
      <ScreenHeader
        action={<BrandMark size={48} />}
        description="Tu configuración de identidad y hogar, reunida en un solo lugar."
        eyebrow="Fase 2 · Hogares"
        title="Hola de nuevo"
      />

      {selectedHousehold === undefined ? (
        <EmptyState
          description="Crea tu primer hogar o acepta una invitación para continuar."
          icon="home-outline"
          title="Aún no hay un hogar activo"
        />
      ) : (
        <GradientCard style={styles.householdHero}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroIcon}>
              <Ionicons color={colors.accentCyan} name="home" size={25} />
            </View>
            <StatusPill label="Seleccionado" tone="success" />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroLabel}>Hogar activo</Text>
            <Text style={styles.heroTitle}>{selectedHousehold.name}</Text>
            <Text style={styles.heroCaption}>{capabilities.roleLabel}</Text>
          </View>
          <AppButton
            icon="people-outline"
            label="Ver detalles del hogar"
            onPress={() => router.push('/(tabs)/household')}
            variant="secondary"
          />
        </GradientCard>
      )}

      <View style={styles.section}>
        <SectionHeader
          description="Acciones de configuración; todavía no hay operaciones financieras."
          title="Acciones rápidas"
        />
        <View style={styles.actionList}>
          {selectedHousehold === undefined ? (
            <ListRow
              caption="Configura el espacio con el que vas a trabajar."
              icon="add-circle-outline"
              onPress={() => router.push('/households/create')}
              title="Crear un hogar"
            />
          ) : null}
          {capabilities.canManageInvitations ? (
            <ListRow
              caption="Genera un código de un solo uso para tu pareja."
              icon="person-add-outline"
              onPress={() => router.push('/households/invite')}
              title="Invitar a una persona"
            />
          ) : null}
          <ListRow
            caption="Usa el código que recibiste después de iniciar sesión."
            icon="key-outline"
            onPress={() => router.push('/invitations/accept')}
            title="Aceptar una invitación"
          />
        </View>
      </View>

      <AppCard style={styles.progressCard}>
        <View style={styles.progressIcon}>
          <Ionicons color={colors.primary} name="shield-checkmark-outline" size={26} />
        </View>
        <View style={styles.progressCopy}>
          <Text style={styles.progressTitle}>Configuración protegida</Text>
          <Text style={styles.progressDescription}>
            Sesión activa · {households.households.length}{' '}
            {households.households.length === 1 ? 'hogar autorizado' : 'hogares autorizados'}
          </Text>
          <Text style={styles.progressFootnote}>
            Usuario interno: {session.profile?.id.slice(0, 8)}…
          </Text>
        </View>
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  actionList: {
    gap: spacing.sm,
  },
  heroCaption: {
    color: colors.textMuted,
    fontFamily: fontFamilies.medium,
    fontSize: 14,
  },
  heroCopy: {
    gap: 4,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(45, 212, 191, 0.12)',
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  heroLabel: {
    color: colors.accentCyan,
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: 27,
    letterSpacing: -0.7,
  },
  heroTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  householdHero: {
    gap: spacing.lg,
  },
  progressCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  progressCopy: {
    flex: 1,
    gap: 4,
  },
  progressDescription: {
    color: colors.textMuted,
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  progressFootnote: {
    color: colors.textSubtle,
    fontFamily: fontFamilies.regular,
    fontSize: 11,
  },
  progressIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(75, 111, 255, 0.12)',
    borderRadius: 18,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  progressTitle: {
    color: colors.text,
    fontFamily: fontFamilies.semibold,
    fontSize: 16,
  },
  section: {
    gap: spacing.md,
  },
});
