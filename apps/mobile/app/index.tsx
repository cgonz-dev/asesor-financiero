import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useMobileApp } from '../src/application/mobile-app-provider';
import { getSessionPresentation } from '../src/application/mobile-app-view-model';
import { AppButton, AppCard, AppScreen, BrandMark, FeedbackCard } from '../src/ui/components';
import { colors, fontFamilies, spacing } from '../src/ui/theme';

export default function SessionGateScreen() {
  const { authenticationAvailable, login, session } = useMobileApp();
  const presentation = getSessionPresentation(session.status, session.message);

  if (session.status === 'authenticated') {
    return <Redirect href="/(tabs)" />;
  }

  if (session.status === 'restoring') {
    return (
      <AppScreen contentStyle={styles.centered} safeBottom scroll={false}>
        <BrandMark size={62} />
        <ActivityIndicator color={colors.accentCyan} size="large" />
        <View style={styles.centeredCopy}>
          <Text style={styles.loadingTitle}>{presentation.title}</Text>
          <Text style={styles.loadingDescription}>{presentation.description}</Text>
        </View>
      </AppScreen>
    );
  }

  const authenticating = session.status === 'authenticating';

  return (
    <AppScreen contentStyle={styles.accessContent} safeBottom>
      <View style={styles.hero}>
        <BrandMark size={68} />
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>FASE 2 · IDENTIDAD</Text>
          <Text style={styles.title}>Copiloto Financiero</Text>
          <Text style={styles.description}>
            Un espacio seguro para organizar tu hogar. Todavía no hay funciones financieras en esta
            pantalla.
          </Text>
        </View>
      </View>

      <AppCard style={styles.accessCard}>
        <FeedbackCard
          message={presentation.description}
          title={presentation.title}
          tone={presentation.tone}
        />
        <AppButton
          disabled={!authenticationAvailable}
          icon="log-in-outline"
          label={authenticating ? 'Abriendo acceso seguro…' : 'Iniciar sesión'}
          loading={authenticating}
          onPress={login}
        />
        {!authenticationAvailable ? (
          <Text style={styles.developmentNote}>
            La autenticación real está disponible en un development build de Android o iOS con las
            variables locales de Auth0 configuradas.
          </Text>
        ) : null}
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  accessCard: {
    gap: spacing.md,
  },
  accessContent: {
    justifyContent: 'center',
    minHeight: '100%',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centeredCopy: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  description: {
    color: colors.textMuted,
    fontFamily: fontFamilies.regular,
    fontSize: 17,
    lineHeight: 27,
  },
  developmentNote: {
    color: colors.textSubtle,
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  eyebrow: {
    color: colors.accentCyan,
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    letterSpacing: 2,
  },
  hero: {
    gap: spacing.lg,
  },
  heroCopy: {
    gap: spacing.sm,
  },
  loadingDescription: {
    color: colors.textMuted,
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 320,
    textAlign: 'center',
  },
  loadingTitle: {
    color: colors.text,
    fontFamily: fontFamilies.semibold,
    fontSize: 20,
  },
  title: {
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: 42,
    letterSpacing: -1.8,
    lineHeight: 49,
  },
});
