export const EVENT_TYPES = [
  'feed',
  'sleep',
  'diaper',
  'medicine',
  'vaccination',
  'growth',
  'memory'
] as const;

export const CONFIDENCE_LEVELS = ['learning', 'low', 'medium', 'high', 'very_high'] as const;

/**
 * Platform-neutral values for NativeWind configuration today and a web design
 * system later. Token names intentionally avoid framework-specific semantics.
 */
export const COLORS = {
  primary: '#FFD54F',
  background: '#FFFDF8',
  backgroundSecondary: '#FFF8E8',
  card: '#FFFFFF',
  section: '#FFF4CC',
  textPrimary: '#2C2C2C',
  textSecondary: '#6B7280',
  textHint: '#9CA3AF',
  success: '#A8D5BA',
  warning: '#FFB84D',
  error: '#F26B6B',
  border: '#ECE7DA'
} as const;

export const RADII = { card: 24, button: 20, sheet: 32, input: 18 } as const;

export const SPACING = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96
} as const;

export const DESIGN_TOKENS = {
  colors: COLORS,
  spacing: SPACING,
  radii: RADII
} as const;
