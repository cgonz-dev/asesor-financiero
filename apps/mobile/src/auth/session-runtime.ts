import { Platform } from 'react-native';

import { getApiBaseUrl, getAuth0Configuration } from '../config';
import { MeApiClient } from '../me-api-client';
import { Auth0NativeSessionSdk } from './auth0-native-session-sdk';
import { Auth0SessionCoordinator } from './auth0-session-coordinator';

export interface MobileSessionRuntime {
  client?: MeApiClient;
  configurationError?: string;
  coordinator?: Auth0SessionCoordinator;
}

export function createMobileSessionRuntime(): MobileSessionRuntime {
  if (Platform.OS === 'web') {
    return {
      configurationError:
        'El login real de Auth0 requiere un development build de iOS o Android; Expo Web no guarda esta sesión móvil.',
    };
  }

  try {
    const configuration = getAuth0Configuration();

    if (configuration === null) {
      return {
        configurationError:
          'Configura las variables EXPO_PUBLIC_AUTH0_* y crea un development build.',
      };
    }

    const coordinator = new Auth0SessionCoordinator(new Auth0NativeSessionSdk(configuration));
    const client = new MeApiClient({
      baseUrl: getApiBaseUrl(),
      tokenProvider: coordinator,
    });

    return { client, coordinator };
  } catch {
    return {
      configurationError: 'La configuración local de Auth0 está incompleta o no es válida.',
    };
  }
}
