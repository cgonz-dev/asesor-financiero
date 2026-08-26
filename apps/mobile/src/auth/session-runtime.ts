import { Platform } from 'react-native';

import { AsyncStorageHouseholdSelectionStore } from '../async-storage-household-selection-store';
import { getApiBaseUrl, getAuth0Configuration } from '../config';
import { HouseholdsApiClient } from '../households-api-client';
import { HouseholdsCoordinator } from '../households-coordinator';
import { HouseholdInvitationsApiClient } from '../household-invitations-api-client';
import { HouseholdInvitationsCoordinator } from '../household-invitations-coordinator';
import { MeApiClient } from '../me-api-client';
import { Auth0NativeSessionSdk } from './auth0-native-session-sdk';
import { Auth0SessionCoordinator } from './auth0-session-coordinator';

export interface MobileSessionRuntime {
  client?: MeApiClient;
  configurationError?: string;
  coordinator?: Auth0SessionCoordinator;
  householdsCoordinator?: HouseholdsCoordinator;
  invitationsCoordinator?: HouseholdInvitationsCoordinator;
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
    const householdsClient = new HouseholdsApiClient({
      baseUrl: getApiBaseUrl(),
      tokenProvider: coordinator,
    });
    const householdsCoordinator = new HouseholdsCoordinator(
      householdsClient,
      new AsyncStorageHouseholdSelectionStore(),
    );
    const invitationsCoordinator = new HouseholdInvitationsCoordinator(
      new HouseholdInvitationsApiClient({
        baseUrl: getApiBaseUrl(),
        tokenProvider: coordinator,
      }),
    );

    return { client, coordinator, householdsCoordinator, invitationsCoordinator };
  } catch {
    return {
      configurationError: 'La configuración local de Auth0 está incompleta o no es válida.',
    };
  }
}
