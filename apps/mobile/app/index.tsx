import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import type { SessionSnapshot } from '../src/auth/auth0-session-coordinator';
import { createMobileSessionRuntime } from '../src/auth/session-runtime';

export default function AuthenticationScreen() {
  const runtime = useMemo(() => createMobileSessionRuntime(), []);
  const [snapshot, setSnapshot] = useState<SessionSnapshot>(() =>
    runtime.coordinator === undefined
      ? {
          message: runtime.configurationError ?? 'La autenticación no está disponible.',
          status: 'error',
        }
      : runtime.coordinator.currentSnapshot(),
  );

  useEffect(() => {
    if (runtime.coordinator === undefined || runtime.client === undefined) {
      return;
    }

    const coordinator = runtime.coordinator;
    const client = runtime.client;
    const unsubscribe = coordinator.subscribe(setSnapshot);
    void coordinator.restore(() => client.getMe());

    return unsubscribe;
  }, [runtime]);

  const login = async () => {
    if (runtime.coordinator !== undefined && runtime.client !== undefined) {
      await runtime.coordinator.login(() => runtime.client!.getMe());
    }
  };

  const logout = async () => {
    await runtime.coordinator?.logout();
  };

  const refreshProfile = async () => {
    if (runtime.coordinator !== undefined && runtime.client !== undefined) {
      await runtime.coordinator.refreshProfile(() => runtime.client!.getMe());
    }
  };

  const isBusy = snapshot.status === 'authenticating' || snapshot.status === 'restoring';
  const isRefreshingProfile = snapshot.profileRefreshStatus === 'refreshing';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <Text style={styles.eyebrow}>FASE 2 · IDENTIDAD</Text>
        <Text style={styles.title}>Copiloto Financiero</Text>
        <Text style={styles.description}>
          Acceso seguro para continuar con la configuración inicial. No hay funciones financieras en
          esta pantalla.
        </Text>

        <View accessibilityLiveRegion="polite" style={styles.statusCard}>
          <Text style={styles.statusLabel}>Estado de sesión</Text>
          {isBusy ? <ActivityIndicator color="#1d4f3a" /> : null}
          <Text style={styles.statusValue}>
            {snapshot.status === 'restoring' && 'Restaurando sesión…'}
            {snapshot.status === 'authenticating' && 'Abriendo Auth0…'}
            {snapshot.status === 'unauthenticated' && 'Inicia sesión para continuar.'}
            {snapshot.status === 'authenticated' && 'Sesión activa.'}
            {snapshot.status === 'error' && (snapshot.message ?? 'No pudimos validar la sesión.')}
          </Text>
          {snapshot.profile === undefined ? null : (
            <Text selectable style={styles.identifier}>
              Usuario: {snapshot.profile.id}
            </Text>
          )}
          {snapshot.profileRefreshStatus === 'succeeded' ? (
            <Text style={styles.profileFeedback}>Perfil consultado correctamente.</Text>
          ) : null}
        </View>

        {snapshot.status === 'authenticated' ? (
          <>
            <SessionButton
              disabled={isRefreshingProfile}
              label={isRefreshingProfile ? 'Consultando…' : 'Consultar mi perfil'}
              onPress={refreshProfile}
            />
            <SessionButton label="Cerrar sesión" onPress={logout} secondary />
          </>
        ) : (
          <SessionButton
            disabled={runtime.coordinator === undefined || isBusy}
            label={snapshot.status === 'authenticating' ? 'Iniciando…' : 'Iniciar sesión'}
            onPress={login}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function SessionButton({
  disabled = false,
  label,
  onPress,
  secondary = false,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => Promise<void>;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => void onPress()}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.buttonSecondary,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#f5f1e8',
    flex: 1,
  },
  container: {
    alignItems: 'stretch',
    flex: 1,
    gap: 20,
    justifyContent: 'center',
    marginHorizontal: 'auto',
    maxWidth: 560,
    padding: 24,
    width: '100%',
  },
  eyebrow: {
    color: '#5c6b49',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  title: {
    color: '#1d2a23',
    fontSize: 38,
    fontWeight: '700',
  },
  description: {
    color: '#526056',
    fontSize: 18,
    lineHeight: 27,
  },
  statusCard: {
    backgroundColor: '#e6eee0',
    borderColor: '#b8c8ae',
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 20,
  },
  statusLabel: {
    color: '#526056',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statusValue: {
    color: '#1d2a23',
    fontSize: 17,
    fontWeight: '600',
  },
  identifier: {
    color: '#526056',
    fontSize: 13,
  },
  profileFeedback: {
    color: '#1d4f3a',
    fontSize: 14,
    fontWeight: '600',
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#1d4f3a',
    borderColor: '#1d4f3a',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonTextSecondary: {
    color: '#1d4f3a',
  },
});
