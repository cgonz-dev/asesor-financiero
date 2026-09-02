import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { getLoginScreenModel, LOGIN_SCREEN_COPY } from '../src/application/login-screen-model';
import { useMobileApp } from '../src/application/mobile-app-provider';
import { getSessionPresentation } from '../src/application/mobile-app-view-model';
import { AppScreen, BrandMark, FeedbackCard } from '../src/ui/components';
import { GoogleAuthButton } from '../src/ui/google-auth-button';
import { colors, fontFamilies, spacing } from '../src/ui/theme';

export default function SessionGateScreen() {
  const { authenticationAvailable, login, session } = useMobileApp();
  const presentation = getSessionPresentation(session.status, session.message);
  const loginScreen = getLoginScreenModel(session.status, authenticationAvailable, session.message);

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

  return (
    <AppScreen contentStyle={styles.accessContent} safeBottom>
      <View style={styles.hero}>
        <BrandMark size={68} />
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>{LOGIN_SCREEN_COPY.brand}</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {LOGIN_SCREEN_COPY.title}
          </Text>
          <Text style={styles.description}>{LOGIN_SCREEN_COPY.description}</Text>
        </View>
      </View>

      <View style={styles.accessPanel}>
        <View style={styles.securityCopy}>
          <Text style={styles.securityTitle}>{LOGIN_SCREEN_COPY.securityTitle}</Text>
          <Text style={styles.securityDescription}>{LOGIN_SCREEN_COPY.securityDescription}</Text>
        </View>
        {loginScreen.feedback === undefined ? null : (
          <FeedbackCard
            message={loginScreen.feedback.description}
            title={loginScreen.feedback.title}
            tone={loginScreen.feedback.tone}
          />
        )}
        <GoogleAuthButton
          disabled={loginScreen.disabled}
          label={loginScreen.action.label}
          loading={loginScreen.loading}
          onPress={login}
        />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  accessPanel: {
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
  securityCopy: {
    borderLeftColor: colors.accentCyan,
    borderLeftWidth: 2,
    gap: 4,
    paddingLeft: spacing.sm,
  },
  securityDescription: {
    color: colors.textMuted,
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    lineHeight: 20,
  },
  securityTitle: {
    color: colors.text,
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
    lineHeight: 20,
  },
  title: {
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: 42,
    letterSpacing: -1.8,
    lineHeight: 49,
  },
});
