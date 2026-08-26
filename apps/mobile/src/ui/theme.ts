export const colors = {
  accentCyan: '#2DD4BF',
  accentViolet: '#8B5CF6',
  background: '#080A0F',
  border: 'rgba(255, 255, 255, 0.10)',
  danger: '#FF6B7A',
  dangerSurface: 'rgba(255, 107, 122, 0.10)',
  glowBlue: 'rgba(75, 111, 255, 0.22)',
  glowViolet: 'rgba(139, 92, 246, 0.18)',
  primary: '#4B6FFF',
  success: '#5EE6A8',
  successSurface: 'rgba(94, 230, 168, 0.10)',
  surface: '#11151C',
  surfaceElevated: '#181D26',
  text: '#F7F8FA',
  textMuted: '#9AA4B2',
  textSubtle: '#6F7A89',
  warning: '#F6C85F',
  warningSurface: 'rgba(246, 200, 95, 0.10)',
} as const;

export const gradients = {
  ambient: ['rgba(75, 111, 255, 0.28)', 'rgba(139, 92, 246, 0.08)', 'transparent'],
  primary: [colors.primary, colors.accentViolet],
  selected: ['#1A2A55', '#241D45', '#122B34'],
} as const;

export const fontFamilies = {
  bold: 'Manrope_700Bold',
  medium: 'Manrope_500Medium',
  regular: 'Manrope_400Regular',
  semibold: 'Manrope_600SemiBold',
} as const;

export const radii = {
  button: 18,
  card: 24,
  input: 18,
  pill: 999,
} as const;

export const spacing = {
  lg: 24,
  md: 16,
  sm: 12,
  xl: 32,
  xs: 8,
  xxl: 44,
} as const;

export const shadows = {
  elevated: {
    elevation: 8,
  },
} as const;
