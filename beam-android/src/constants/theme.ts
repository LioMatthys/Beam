import { Platform } from 'react-native';

/**
 * Beam design tokens — the Tempo design system (dark, lime → teal), shared with
 * the Windows receiver so both apps look like one product.
 */
const palette = {
  bg: '#0F0F14',
  surface: '#181820',
  surfaceElevated: '#22222D',
  border: '#2A2A36',
  borderStrong: '#363645',
  text: '#F2F4F7',
  textMuted: '#8A95A5',
  textDim: '#5C6675',
  accent: '#D4FF3F',
  accentDim: '#A4D824',
  accentSurface: 'rgba(212, 255, 63, 0.10)',
  teal: '#2DD4BF',
  tealSurface: 'rgba(45, 212, 191, 0.10)',
  danger: '#FF5A5F',
  dangerSurface: 'rgba(255, 90, 95, 0.12)',
  warning: '#FFB347',
  success: '#34D399',
};

/** Signature lime → teal gradient. Use for primary CTAs and brand accents. */
export const BrandGradient = {
  colors: ['#D4FF3F', '#2DD4BF'] as const,
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
};

const scheme = {
  text: palette.text,
  textMuted: palette.textMuted,
  textDim: palette.textDim,
  background: palette.bg,
  surface: palette.surface,
  surfaceElevated: palette.surfaceElevated,
  border: palette.border,
  borderStrong: palette.borderStrong,
  tint: palette.accent,
  accent: palette.accent,
  accentDim: palette.accentDim,
  accentSurface: palette.accentSurface,
  teal: palette.teal,
  tealSurface: palette.tealSurface,
  danger: palette.danger,
  dangerSurface: palette.dangerSurface,
  warning: palette.warning,
  success: palette.success,
  icon: palette.textMuted,
};

// Force the dark aesthetic regardless of system theme.
export const Colors = {
  light: scheme,
  dark: scheme,
};

export type ThemeColor = keyof typeof scheme;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    mono: 'monospace',
  },
});
