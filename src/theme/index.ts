export const colors = {
  background: '#0D0D14',
  surface: '#1A1A2E',
  surfaceVariant: '#242438',
  surfaceBorder: '#2D2D48',
  primary: '#7B68EE',
  primaryDark: '#5A4FCC',
  primaryFaded: 'rgba(123, 104, 238, 0.15)',
  recording: '#FF4757',
  recordingFaded: 'rgba(255, 71, 87, 0.2)',
  paused: '#FFA502',
  pausedFaded: 'rgba(255, 165, 2, 0.2)',
  success: '#2ED573',
  text: '#F0F0F8',
  textSecondary: '#8888AA',
  textMuted: '#555566',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.7)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const typography = {
  h1: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -0.5, color: '#F0F0F8' },
  h2: { fontSize: 24, fontWeight: '600' as const, color: '#F0F0F8' },
  h3: { fontSize: 18, fontWeight: '600' as const, color: '#F0F0F8' },
  body: { fontSize: 16, fontWeight: '400' as const, color: '#F0F0F8' },
  caption: { fontSize: 14, fontWeight: '400' as const, color: '#8888AA' },
  small: { fontSize: 12, fontWeight: '400' as const, color: '#8888AA' },
  mono: { fontSize: 15, fontFamily: 'monospace' as const, color: '#F0F0F8' },
};
