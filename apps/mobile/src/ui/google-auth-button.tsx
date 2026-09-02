import { useMemo } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import googleLogo from '../../assets/brand/google-g.png';
import { createSingleFlightAction, getGoogleAuthButtonState } from './google-auth-button-model';
import { usePressMotion } from './motion';

export function GoogleAuthButton({
  disabled = false,
  label,
  loading = false,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  loading?: boolean;
  onPress: () => void | Promise<void>;
}) {
  const pressMotion = usePressMotion();
  const singleFlightAction = useMemo(() => createSingleFlightAction(onPress), [onPress]);

  const { accessibilityState, blocked } = getGoogleAuthButtonState(disabled, loading);

  return (
    <Animated.View style={[styles.motionContainer, pressMotion.style]}>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityState={accessibilityState}
        android_ripple={{ color: 'rgba(255, 255, 255, 0.10)' }}
        disabled={blocked}
        onPress={() => void singleFlightAction()}
        onPressIn={pressMotion.onPressIn}
        onPressOut={pressMotion.onPressOut}
        style={({ pressed }) => [
          styles.button,
          pressed && !blocked && styles.pressed,
          blocked && styles.disabled,
        ]}
      >
        <View style={styles.content}>
          {loading ? (
            <ActivityIndicator color="#E3E3E3" size="small" />
          ) : (
            <Image
              accessible={false}
              resizeMode="contain"
              source={googleLogo}
              style={styles.logo}
            />
          )}
          <Text style={styles.label}>{label}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#131314',
    borderColor: '#8E918F',
    borderRadius: 27,
    borderWidth: 1,
    minHeight: 54,
    overflow: 'hidden',
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Platform.OS === 'ios' ? 12 : 10,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: Platform.OS === 'ios' ? 16 : 12,
  },
  disabled: {
    opacity: 0.48,
  },
  label: {
    color: '#E3E3E3',
    fontFamily: Platform.select({
      android: 'sans-serif-medium',
      default: 'sans-serif',
      ios: 'System',
    }),
    fontSize: 14,
    lineHeight: 20,
  },
  logo: {
    height: 20,
    width: 20,
  },
  motionContainer: {
    width: '100%',
  },
  pressed: {
    opacity: 0.9,
  },
});
