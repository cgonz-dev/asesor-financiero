import type { ConfigContext, ExpoConfig } from 'expo/config';

const DEVELOPMENT_BUNDLE_IDENTIFIER = 'com.copilotofinanciero.dev';
const AUTH0_CUSTOM_SCHEME = 'copilotofinanciero';

export default ({ config }: ConfigContext): ExpoConfig => {
  const auth0Domain = process.env.EXPO_PUBLIC_AUTH0_DOMAIN?.trim();
  const plugins = [...(config.plugins ?? [])];

  if (auth0Domain !== undefined && auth0Domain.length > 0) {
    plugins.push([
      'react-native-auth0',
      {
        customScheme: AUTH0_CUSTOM_SCHEME,
        domain: auth0Domain,
      },
    ]);
  }

  return {
    ...config,
    name: config.name ?? 'Copiloto Financiero',
    slug: config.slug ?? 'copiloto-financiero',
    android: {
      ...config.android,
      package: DEVELOPMENT_BUNDLE_IDENTIFIER,
    },
    ios: {
      ...config.ios,
      bundleIdentifier: DEVELOPMENT_BUNDLE_IDENTIFIER,
    },
    plugins,
    scheme: AUTH0_CUSTOM_SCHEME,
  };
};
