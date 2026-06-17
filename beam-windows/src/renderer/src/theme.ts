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
  accent: '#2E9BFF',
  accentDim: '#1E7FE0',
  accentSurface: 'rgba(46, 155, 255, 0.12)',
  teal: '#FFA24B',
  tealSurface: 'rgba(255, 162, 75, 0.12)',
  purple: '#B24BE6',
  danger: '#FF5A5F',
  dangerSurface: 'rgba(255, 90, 95, 0.12)',
  warning: '#FFB347',
  success: '#34D399'
} as const

/** Signature apricot → purple → flashy-blue gradient. Primary CTAs and brand accents. */
export const brandGradient = `linear-gradient(135deg, ${palette.teal} 0%, ${palette.purple} 50%, ${palette.accent} 100%)`

export const fontStack =
  "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
export const monoStack =
  "'Cascadia Code', 'Consolas', 'SFMono-Regular', Menlo, monospace"
