import { HouseholdInvitationTokenSchema } from '@copiloto/contracts';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useMobileApp } from '../../src/application/mobile-app-provider';
import {
  AppButton,
  AppScreen,
  AppTextInput,
  FeedbackCard,
  IconButton,
  ScreenHeader,
} from '../../src/ui/components';
import { spacing } from '../../src/ui/theme';

export default function AcceptInvitationScreen() {
  const { acceptInvitation, internalUserId, invitations, session } = useMobileApp();
  const [token, setToken] = useState('');
  const [error, setError] = useState<string>();
  const [acceptedHouseholdName, setAcceptedHouseholdName] = useState<string>();
  const accepting = invitations.status === 'accepting';

  if (session.status !== 'authenticated' || internalUserId === undefined) {
    return <Redirect href="/" />;
  }

  const submit = async () => {
    const parsed = HouseholdInvitationTokenSchema.safeParse(token.trim());

    if (!parsed.success) {
      setError('El código de invitación no tiene un formato válido.');
      return;
    }

    setError(undefined);
    const household = await acceptInvitation(parsed.data);

    if (household !== undefined) {
      setToken('');
      setAcceptedHouseholdName(household.name);
    }
  };

  return (
    <AppScreen contentStyle={styles.content} safeBottom>
      <ScreenHeader
        action={
          <IconButton accessibilityLabel="Cerrar" icon="close" onPress={() => router.back()} />
        }
        description="Debes iniciar sesión con el mismo correo al que fue dirigida la invitación."
        eyebrow="Unirte a un hogar"
        title={acceptedHouseholdName === undefined ? 'Acepta una invitación' : 'Ya eres integrante'}
      />

      {acceptedHouseholdName === undefined ? (
        <View style={styles.form}>
          <AppTextInput
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            editable={!accepting}
            error={error}
            label="Código de invitación"
            maxLength={43}
            onChangeText={(value) => {
              setToken(value);
              setError(undefined);
            }}
            placeholder="Pega aquí el código recibido"
            value={token}
          />

          {invitations.status === 'error' ? (
            <FeedbackCard
              message={invitations.message}
              title="La invitación no está disponible"
              tone="danger"
            />
          ) : null}

          <AppButton
            icon="checkmark-circle-outline"
            label={accepting ? 'Validando invitación…' : 'Aceptar invitación'}
            loading={accepting}
            onPress={submit}
          />
          <AppButton label="Cancelar" onPress={() => router.back()} variant="ghost" />
        </View>
      ) : (
        <View style={styles.form}>
          <FeedbackCard
            message={`${acceptedHouseholdName} quedó seleccionado como tu hogar activo.`}
            title="Invitación aceptada correctamente"
            tone="success"
          />
          <AppButton
            icon="people-outline"
            label="Ver el hogar"
            onPress={() => router.replace('/(tabs)/household')}
          />
        </View>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'center',
  },
  form: {
    gap: spacing.md,
  },
});
