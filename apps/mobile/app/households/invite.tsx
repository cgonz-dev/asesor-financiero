import { InvitationTargetEmailSchema } from '@copiloto/contracts';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';

import { useMobileApp } from '../../src/application/mobile-app-provider';
import {
  AppButton,
  AppCard,
  AppScreen,
  AppTextInput,
  FeedbackCard,
  IconButton,
  ScreenHeader,
} from '../../src/ui/components';
import { colors, fontFamilies, spacing } from '../../src/ui/theme';

export default function InviteHouseholdMemberScreen() {
  const {
    createInvitation,
    dismissRawInvitationToken,
    internalUserId,
    invitations,
    selectedHousehold,
    session,
  } = useMobileApp();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const rawToken = invitations.rawInvitationToken;
  const creating = invitations.status === 'creating';

  useEffect(() => dismissRawInvitationToken, [dismissRawInvitationToken]);

  if (session.status !== 'authenticated' || internalUserId === undefined) {
    return <Redirect href="/" />;
  }

  const close = () => {
    dismissRawInvitationToken();
    router.back();
  };

  const submit = async () => {
    const parsed = InvitationTargetEmailSchema.safeParse(email);

    if (!parsed.success) {
      setError('Escribe un correo válido para la persona invitada.');
      return;
    }

    setError(undefined);

    if (await createInvitation(parsed.data)) {
      setEmail('');
    }
  };

  const shareInvitation = async () => {
    if (rawToken === undefined) {
      return;
    }

    try {
      await Share.share({
        message: `Te invitaron a un hogar de Copiloto Financiero. Inicia sesión y pega este código en “Aceptar invitación”:\n\n${rawToken}`,
        title: 'Invitación a Copiloto Financiero',
      });
    } finally {
      close();
    }
  };

  if (selectedHousehold?.role !== 'owner') {
    return (
      <AppScreen contentStyle={styles.content} safeBottom>
        <ScreenHeader
          action={<IconButton accessibilityLabel="Cerrar" icon="close" onPress={close} />}
          eyebrow="Invitaciones"
          title="Acción no disponible"
        />
        <FeedbackCard
          message="Solo el propietario del hogar puede generar invitaciones."
          title="No tienes permiso para esta acción"
          tone="warning"
        />
        <AppButton label="Volver" onPress={close} variant="secondary" />
      </AppScreen>
    );
  }

  return (
    <AppScreen contentStyle={styles.content} safeBottom>
      <ScreenHeader
        action={<IconButton accessibilityLabel="Cerrar" icon="close" onPress={close} />}
        description={`La invitación dará acceso como integrante a ${selectedHousehold.name}.`}
        eyebrow="Invitación segura"
        title={rawToken === undefined ? 'Invita a tu pareja' : 'Código listo'}
      />

      {rawToken === undefined ? (
        <View style={styles.form}>
          <AppTextInput
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            editable={!creating}
            error={error}
            keyboardType="email-address"
            label="Correo verificado de la persona"
            maxLength={320}
            onChangeText={(value) => {
              setEmail(value);
              setError(undefined);
            }}
            placeholder="pareja@example.com"
            value={email}
          />

          <FeedbackCard
            message="El código se mostrará una sola vez y únicamente funcionará con este correo autenticado."
            title="Acceso dirigido y revocable"
          />

          {invitations.status === 'error' ? (
            <FeedbackCard
              message={invitations.message}
              title="No pudimos generar la invitación"
              tone="danger"
            />
          ) : null}

          <AppButton
            icon="key-outline"
            label={creating ? 'Generando código…' : 'Generar invitación'}
            loading={creating}
            onPress={submit}
          />
          <AppButton label="Cancelar" onPress={close} variant="ghost" />
        </View>
      ) : (
        <View style={styles.form}>
          <FeedbackCard
            message="Compártelo ahora. Al salir de esta pantalla, la aplicación lo eliminará de memoria."
            title="Invitación creada correctamente"
            tone="success"
          />
          <AppCard style={styles.tokenCard}>
            <Text style={styles.tokenLabel}>Código de un solo uso</Text>
            <Text selectable style={styles.tokenValue}>
              {rawToken}
            </Text>
          </AppCard>
          <AppButton
            icon="share-social-outline"
            label="Compartir invitación"
            onPress={shareInvitation}
          />
          <AppButton label="Cerrar sin compartir" onPress={close} variant="danger" />
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
  tokenCard: {
    gap: spacing.sm,
  },
  tokenLabel: {
    color: colors.textMuted,
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  tokenValue: {
    color: colors.text,
    fontFamily: fontFamilies.medium,
    fontSize: 16,
    letterSpacing: 0.8,
    lineHeight: 25,
  },
});
