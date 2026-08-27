import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Children, useState, type PropsWithChildren, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { motionDurations, useAmbientMotion, usePressMotion, useRevealMotion } from './motion';
import { colors, fontFamilies, gradients, radii, shadows, spacing } from './theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function Reveal({ children, delay = 0 }: PropsWithChildren<{ delay?: number }>) {
  const animatedStyle = useRevealMotion(delay);
  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

function AmbientGlow({ secondary = false }: { secondary?: boolean }) {
  const animatedStyle = useAmbientMotion(secondary);

  return (
    <Animated.View
      style={[secondary ? styles.ambientGlowSecondary : styles.ambientGlowPrimary, animatedStyle]}
    />
  );
}

export function AppScreen({
  children,
  contentStyle,
  safeBottom = false,
  scroll = true,
}: PropsWithChildren<{
  contentStyle?: StyleProp<ViewStyle>;
  safeBottom?: boolean;
  scroll?: boolean;
}>) {
  const content = (
    <View style={[styles.screenContent, contentStyle]}>
      {Children.toArray(children).map((child, index) => (
        <Reveal delay={Math.min(index * motionDurations.stagger, 260)} key={index}>
          {child}
        </Reveal>
      ))}
    </View>
  );

  return (
    <SafeAreaView
      edges={safeBottom ? ['top', 'bottom', 'left', 'right'] : ['top', 'left', 'right']}
      style={styles.safeArea}
    >
      <AmbientGlow />
      <AmbientGlow secondary />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardArea}
      >
        {scroll ? (
          <ScrollView
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            contentContainerStyle={styles.scrollContent}
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {content}
          </ScrollView>
        ) : (
          content
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function ScreenHeader({
  action,
  description,
  eyebrow,
  title,
}: {
  action?: ReactNode;
  description?: string | undefined;
  eyebrow: string;
  title: string;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTopRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text>
          <Text
            accessibilityRole="header"
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            numberOfLines={2}
            style={styles.title}
          >
            {title}
          </Text>
        </View>
        {action === undefined ? null : <View style={styles.headerAction}>{action}</View>}
      </View>
      {description === undefined ? null : <Text style={styles.description}>{description}</Text>}
    </View>
  );
}

export function BrandMark({ size = 48 }: { size?: number }) {
  return (
    <LinearGradient
      colors={gradients.primary}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={[styles.brandMark, { borderRadius: size * 0.32, height: size, width: size }]}
    >
      <Text style={[styles.brandLetters, { fontSize: size * 0.35 }]}>CF</Text>
    </LinearGradient>
  );
}

export function AppCard({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function GradientCard({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return (
    <LinearGradient
      colors={gradients.selected}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={[styles.gradientCard, style]}
    >
      {children}
    </LinearGradient>
  );
}

export function SectionHeader({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description?: string | undefined;
  title: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {description === undefined ? null : (
          <Text style={styles.sectionDescription}>{description}</Text>
        )}
      </View>
      {action}
    </View>
  );
}

export function AppButton({
  disabled = false,
  icon,
  label,
  loading = false,
  onPress,
  variant = 'primary',
}: {
  disabled?: boolean;
  icon?: IconName;
  label: string;
  loading?: boolean;
  onPress: () => void | Promise<void>;
  variant?: 'danger' | 'ghost' | 'primary' | 'secondary';
}) {
  const blocked = disabled || loading;
  const pressMotion = usePressMotion();
  const buttonContent = (
    <View style={styles.buttonContent}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.text : colors.textMuted} />
      ) : icon === undefined ? null : (
        <Ionicons
          color={variant === 'danger' ? colors.danger : colors.text}
          name={icon}
          size={20}
        />
      )}
      <Text
        style={[
          styles.buttonLabel,
          variant === 'danger' && styles.dangerButtonLabel,
          blocked && styles.disabledLabel,
        ]}
      >
        {label}
      </Text>
    </View>
  );

  return (
    <Animated.View style={[styles.motionPressable, pressMotion.style]}>
      <Pressable
        accessibilityRole="button"
        android_ripple={{ color: 'rgba(255, 255, 255, 0.10)' }}
        disabled={blocked}
        onPress={() => void onPress()}
        onPressIn={pressMotion.onPressIn}
        onPressOut={pressMotion.onPressOut}
        style={({ pressed }) => [
          styles.buttonPressable,
          pressed && !blocked && styles.pressed,
          blocked && styles.disabled,
        ]}
      >
        {variant === 'primary' ? (
          <LinearGradient
            colors={gradients.primary}
            end={{ x: 1, y: 0.75 }}
            start={{ x: 0, y: 0.2 }}
            style={styles.primaryButton}
          >
            {buttonContent}
          </LinearGradient>
        ) : (
          <View
            style={[
              styles.outlineButton,
              variant === 'ghost' && styles.ghostButton,
              variant === 'danger' && styles.dangerButton,
            ]}
          >
            {buttonContent}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export function IconButton({
  accessibilityLabel,
  icon,
  onPress,
}: {
  accessibilityLabel: string;
  icon: IconName;
  onPress: () => void;
}) {
  const pressMotion = usePressMotion(0.9);

  return (
    <Animated.View style={pressMotion.style}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        android_ripple={{ borderless: true, color: 'rgba(45, 212, 191, 0.16)' }}
        onPress={onPress}
        onPressIn={pressMotion.onPressIn}
        onPressOut={pressMotion.onPressOut}
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
      >
        <Ionicons color={colors.text} name={icon} size={22} />
      </Pressable>
    </Animated.View>
  );
}

export function AppTextInput({
  error,
  keyboardType,
  label,
  onBlur,
  onFocus,
  ...props
}: TextInputProps & {
  error?: string | undefined;
  keyboardType?: KeyboardTypeOptions;
  label: string;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.inputGroup}>
      <Text style={[styles.inputLabel, focused && styles.inputLabelFocused]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        keyboardType={keyboardType}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        placeholderTextColor={colors.textSubtle}
        selectionColor={colors.accentCyan}
        style={[
          styles.input,
          focused && styles.inputFocused,
          error === undefined ? null : styles.inputError,
        ]}
        {...props}
      />
      {error === undefined ? null : <Text style={styles.fieldError}>{error}</Text>}
    </View>
  );
}

export function FeedbackCard({
  message,
  title,
  tone = 'neutral',
}: {
  message?: string | undefined;
  title: string;
  tone?: 'danger' | 'neutral' | 'success' | 'warning';
}) {
  const icon: IconName =
    tone === 'danger'
      ? 'alert-circle-outline'
      : tone === 'success'
        ? 'checkmark-circle-outline'
        : tone === 'warning'
          ? 'information-circle-outline'
          : 'sparkles-outline';
  const iconColor =
    tone === 'danger'
      ? colors.danger
      : tone === 'success'
        ? colors.success
        : tone === 'warning'
          ? colors.warning
          : colors.accentCyan;

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.feedbackCard,
        tone === 'danger' && styles.feedbackDanger,
        tone === 'success' && styles.feedbackSuccess,
        tone === 'warning' && styles.feedbackWarning,
      ]}
    >
      <Ionicons color={iconColor} name={icon} size={24} />
      <View style={styles.feedbackCopy}>
        <Text style={styles.feedbackTitle}>{title}</Text>
        {message === undefined ? null : <Text style={styles.feedbackMessage}>{message}</Text>}
      </View>
    </View>
  );
}

export function EmptyState({
  description,
  icon,
  title,
}: {
  description: string;
  icon: IconName;
  title: string;
}) {
  return (
    <AppCard style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons color={colors.accentCyan} name={icon} size={26} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
    </AppCard>
  );
}

export function ListRow({
  caption,
  icon,
  onPress,
  selected = false,
  title,
  trailing,
}: {
  caption?: string | undefined;
  icon: IconName;
  onPress?: () => void;
  selected?: boolean;
  title: string;
  trailing?: ReactNode;
}) {
  const pressMotion = usePressMotion(0.985);
  const content = (
    <>
      <View style={[styles.listIcon, selected && styles.listIconSelected]}>
        <Ionicons color={selected ? colors.accentCyan : colors.textMuted} name={icon} size={21} />
      </View>
      <View style={styles.listCopy}>
        <Text style={styles.listTitle}>{title}</Text>
        {caption === undefined ? null : <Text style={styles.listCaption}>{caption}</Text>}
      </View>
      {trailing ??
        (onPress === undefined ? null : (
          <Ionicons color={colors.textSubtle} name="chevron-forward" size={19} />
        ))}
    </>
  );

  if (onPress === undefined) {
    return <View style={[styles.listRow, selected && styles.listRowSelected]}>{content}</View>;
  }

  return (
    <Animated.View style={pressMotion.style}>
      <Pressable
        accessibilityRole="button"
        android_ripple={{ color: 'rgba(45, 212, 191, 0.08)' }}
        onPress={onPress}
        onPressIn={pressMotion.onPressIn}
        onPressOut={pressMotion.onPressOut}
        style={({ pressed }) => [
          styles.listRow,
          selected && styles.listRowSelected,
          pressed && styles.pressed,
        ]}
      >
        {content}
      </Pressable>
    </Animated.View>
  );
}

export function StatusPill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'success';
}) {
  return (
    <View style={[styles.pill, tone === 'success' && styles.pillSuccess]}>
      <Text style={[styles.pillText, tone === 'success' && styles.pillTextSuccess]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ambientGlowPrimary: {
    backgroundColor: colors.glowBlue,
    borderRadius: 180,
    height: 300,
    pointerEvents: 'none',
    position: 'absolute',
    right: -170,
    top: -130,
    width: 300,
  },
  ambientGlowSecondary: {
    backgroundColor: colors.glowViolet,
    borderRadius: 150,
    height: 250,
    left: -180,
    pointerEvents: 'none',
    position: 'absolute',
    top: 260,
    width: 250,
  },
  brandLetters: {
    color: colors.text,
    fontFamily: fontFamilies.bold,
    letterSpacing: -0.8,
  },
  brandMark: {
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.elevated,
  },
  buttonContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: spacing.md,
  },
  buttonLabel: {
    color: colors.text,
    fontFamily: fontFamilies.semibold,
    fontSize: 16,
  },
  buttonPressable: {
    borderRadius: radii.button,
    minHeight: 54,
    overflow: 'hidden',
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    padding: spacing.lg,
  },
  dangerButton: {
    backgroundColor: colors.dangerSurface,
    borderColor: 'rgba(255, 107, 122, 0.30)',
  },
  dangerButtonLabel: {
    color: colors.danger,
  },
  description: {
    color: colors.textMuted,
    fontFamily: fontFamilies.regular,
    fontSize: 16,
    lineHeight: 25,
    marginTop: spacing.sm,
    maxWidth: 560,
  },
  disabled: {
    opacity: 0.48,
  },
  disabledLabel: {
    color: colors.textMuted,
  },
  emptyDescription: {
    color: colors.textMuted,
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(45, 212, 191, 0.10)',
    borderRadius: 18,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {
    color: colors.text,
    fontFamily: fontFamilies.semibold,
    fontSize: 18,
    textAlign: 'center',
  },
  eyebrow: {
    color: colors.accentCyan,
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    letterSpacing: 2,
  },
  feedbackCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  feedbackCopy: {
    flex: 1,
    gap: 3,
  },
  feedbackDanger: {
    backgroundColor: colors.dangerSurface,
    borderColor: 'rgba(255, 107, 122, 0.24)',
  },
  feedbackMessage: {
    color: colors.textMuted,
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  feedbackSuccess: {
    backgroundColor: colors.successSurface,
    borderColor: 'rgba(94, 230, 168, 0.24)',
  },
  feedbackTitle: {
    color: colors.text,
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
    lineHeight: 20,
  },
  feedbackWarning: {
    backgroundColor: colors.warningSurface,
    borderColor: 'rgba(246, 200, 95, 0.24)',
  },
  fieldError: {
    color: colors.danger,
    fontFamily: fontFamilies.medium,
    fontSize: 12,
  },
  ghostButton: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  gradientCard: {
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: radii.card,
    borderWidth: 1,
    overflow: 'hidden',
    padding: spacing.lg,
    ...shadows.elevated,
  },
  header: {
    gap: spacing.md,
  },
  headerAction: {
    flexShrink: 0,
    paddingTop: 2,
  },
  headerCopy: {
    flex: 1,
    gap: spacing.sm,
    minWidth: 0,
  },
  headerTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: radii.input,
    borderWidth: 1,
    color: colors.text,
    fontFamily: fontFamilies.medium,
    fontSize: 16,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inputError: {
    borderColor: colors.danger,
  },
  inputFocused: {
    backgroundColor: '#1B212B',
    borderColor: colors.accentCyan,
  },
  inputGroup: {
    gap: spacing.xs,
  },
  inputLabel: {
    color: colors.textMuted,
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
  inputLabelFocused: {
    color: colors.accentCyan,
  },
  keyboardArea: {
    flex: 1,
  },
  listCaption: {
    color: colors.textMuted,
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  listCopy: {
    flex: 1,
    gap: 2,
  },
  listIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  listIconSelected: {
    backgroundColor: 'rgba(45, 212, 191, 0.12)',
  },
  listRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 72,
    padding: spacing.sm,
  },
  listRowSelected: {
    backgroundColor: '#151C26',
    borderColor: 'rgba(45, 212, 191, 0.44)',
  },
  listTitle: {
    color: colors.text,
    fontFamily: fontFamilies.semibold,
    fontSize: 15,
  },
  motionPressable: {
    width: '100%',
  },
  outlineButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.button,
    borderWidth: 1,
  },
  pill: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.pill,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  pillSuccess: {
    backgroundColor: colors.successSurface,
  },
  pillText: {
    color: colors.textMuted,
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
  },
  pillTextSuccess: {
    color: colors.success,
  },
  pressed: {
    opacity: 0.9,
  },
  primaryButton: {
    borderRadius: radii.button,
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  screenContent: {
    alignSelf: 'center',
    flexGrow: 1,
    gap: spacing.lg,
    maxWidth: 720,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
  },
  sectionDescription: {
    color: colors.textMuted,
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  sectionHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  sectionHeaderCopy: {
    flex: 1,
    gap: 3,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: 21,
    letterSpacing: -0.4,
  },
  title: {
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: 34,
    letterSpacing: -1.4,
    lineHeight: 42,
  },
});
