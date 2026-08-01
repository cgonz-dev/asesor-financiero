import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { getApiBaseUrl } from '../src/config';
import { HealthApiClient, HealthApiClientError } from '../src/health-api-client';

type ConnectionState = 'connected' | 'error' | 'loading';

const healthClient = new HealthApiClient({
  baseUrl: getApiBaseUrl(),
});

export default function BootstrapScreen() {
  const [connectionState, setConnectionState] = useState<ConnectionState>('loading');
  const [detail, setDetail] = useState('Consultando la API…');

  useEffect(() => {
    const controller = new AbortController();

    void healthClient
      .getHealth({ signal: controller.signal })
      .then((health) => {
        setConnectionState('connected');
        setDetail(`API conectada · versión ${health.version}`);
      })
      .catch((error: unknown) => {
        if (error instanceof HealthApiClientError && error.code === 'cancelled') {
          return;
        }

        setConnectionState('error');
        setDetail(
          error instanceof HealthApiClientError
            ? error.message
            : 'Ocurrió un error inesperado al consultar la API.',
        );
      });

    return () => controller.abort();
  }, []);

  const refreshHealth = async () => {
    setConnectionState('loading');
    setDetail('Consultando la API…');

    try {
      const health = await healthClient.getHealth();
      setConnectionState('connected');
      setDetail(`API conectada · versión ${health.version}`);
    } catch (error) {
      setConnectionState('error');
      setDetail(
        error instanceof HealthApiClientError
          ? error.message
          : 'Ocurrió un error inesperado al consultar la API.',
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <Text style={styles.eyebrow}>FASE 1 · BOOTSTRAP</Text>
        <Text style={styles.title}>Copiloto Financiero</Text>
        <Text style={styles.description}>
          La base técnica está iniciando. Todavía no existe funcionalidad financiera.
        </Text>

        <View
          accessibilityLiveRegion="polite"
          style={[styles.statusCard, connectionState === 'error' && styles.statusCardError]}
        >
          <Text style={styles.statusLabel}>Estado de conexión</Text>
          <Text style={styles.statusValue}>{detail}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={connectionState === 'loading'}
          onPress={() => void refreshHealth()}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            connectionState === 'loading' && styles.buttonDisabled,
          ]}
        >
          <Text style={styles.buttonText}>
            {connectionState === 'loading' ? 'Consultando…' : 'Volver a consultar'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
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
    gap: 24,
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
    gap: 8,
    padding: 20,
  },
  statusCardError: {
    backgroundColor: '#f8e5df',
    borderColor: '#d9ada0',
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
  button: {
    alignItems: 'center',
    backgroundColor: '#1d4f3a',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 15,
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
});
