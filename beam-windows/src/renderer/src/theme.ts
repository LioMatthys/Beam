/**
 * Beam design tokens — ported verbatim from the Tempo design system
 * (rehab-tracker-expo/constants/theme.ts) so the desktop receiver and the
 * phone app share one visual language.
 */
export const palette = {
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
  success: '#34D399'
} as const

/** Signature lime → teal gradient. Primary CTAs and brand accents. */
export const brandGradient = `linear-gradient(135deg, ${palette.accent} 0%, ${palette.teal} 100%)`

export const fontStack =
  "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
export const monoStack =
  "'Cascadia Code', 'Consolas', 'SFMono-Regular', Menlo, monospace"
