import { HOUSEHOLD_NAME_MAX_LENGTH, HouseholdNameSchema } from '@copiloto/contracts';
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

export default function CreateHouseholdScreen() {
  const { createHousehold, households, internalUserId, session } = useMobileApp();
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();
  const creating = households.status === 'creating';

  if (session.status !== 'authenticated' || internalUserId === undefined) {
    return <Redirect href="/" />;
  }

  const submit = async () => {
    const parsed = HouseholdNameSchema.safeParse(name);

    if (!parsed.success) {
      setError(
        name.trim().length === 0
          ? 'Escribe un nombre para tu hogar.'
          : `Usa máximo ${HOUSEHOLD_NAME_MAX_LENGTH} caracteres.`,
      );
      return;
    }

    setError(undefined);

    if (await createHousehold(parsed.data)) {
      setName('');
      router.back();
    }
  };

  return (
    <AppScreen contentStyle={styles.content} safeBottom>
      <ScreenHeader
        action={
          <IconButton accessibilityLabel="Cerrar" icon="close" onPress={() => router.back()} />
        }
        description="Este nombre identifica el espacio compartido. Podrás cambiar entre hogares desde la pestaña Hogar."
        eyebrow="Nuevo hogar"
        title="Crea tu espacio"
      />

      <View style={styles.form}>
        <AppTextInput
          autoCapitalize="sentences"
          autoFocus
          editable={!creating}
          error={error}
          label="Nombre del hogar"
          maxLength={HOUSEHOLD_NAME_MAX_LENGTH}
          onChangeText={(value) => {
            setName(value);
            setError(undefined);
          }}
          placeholder="Ej. Hogar de Ana y Luis"
          returnKeyType="done"
          value={name}
        />

        {households.status === 'error' ? (
          <FeedbackCard
            message={households.message}
            title="No pudimos crear el hogar"
            tone="danger"
          />
        ) : null}

        <AppButton
          icon="home-outline"
          label={creating ? 'Creando hogar…' : 'Crear hogar'}
          loading={creating}
          onPress={submit}
        />
        <AppButton label="Cancelar" onPress={() => router.back()} variant="ghost" />
      </View>
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
