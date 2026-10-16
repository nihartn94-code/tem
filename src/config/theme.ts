/**
 * PharmaOS Design System v2.0
 * Complete rebuild with dark mode, semantic tokens, and accessibility
 * 
 * Three-color status system per SRS §5:
 * green = safe/confirmed/money-in
 * yellow = pending/in-transit
 * red = alert/dispute/expiring
 */

import { useColorScheme } from 'react-native';

// ============================================================
// SEMANTIC COLOR TOKENS (Light + Dark)
// ============================================

const LightColors = {
  // Background hierarchy
  background: '#F5F5FA',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfacePressed: '#EEEFF3',

  // Text hierarchy
  textPrimary: '#0F1117',
  textSecondary: '#5A6072',
  textTertiary: '#8E95A4',
  textInverse: '#FFFFFF',
  textLink: '#3B6EF5',

  // Borders
  border: '#E2E4EB',
  borderLight: '#EEEFF3',
  borderFocus: '#3B6EF5',

  // Primary brand
  primary: '#1B5E20',
  primaryHover: '#2E7D32',
  primaryPressed: '#0D3B0F',
  primarySurface: '#E8F5E9',
  primaryText: '#FFFFFF',

  // Secondary
  secondary: '#1565C0',
  secondaryHover: '#1976D2',
  secondarySurface: '#E3F2FD',
  secondaryText: '#FFFFFF',

  // Status colors (SRS §5)
  safe: '#2E7D32',
  safeHover: '#388E3C',
  safeSurface: '#E8F5E9',
  safeText: '#1B5E20',

  pending: '#F57F17',
  pendingHover: '#FF8F00',
  pendingSurface: '#FFF8E1',
  pendingText: '#E65100',

  danger: '#C62828',
  dangerHover: '#D32F2F',
  dangerSurface: '#FFEBEE',
  dangerText: '#B71C1C',

  // Role accents
  roleAdmin: '#D84315',
  roleManufacturer: '#7B1FA2',
  roleCompany: '#1565C0',
  roleStockist: '#00695C',
};

export type Palette = typeof LightColors;

const DarkColors: Palette = {
  // Background hierarchy
  background: '#0F1117',
  surface: '#1A1D24',
  surfaceElevated: '#23262E',
  surfacePressed: '#2C3038',

  // Text hierarchy
  textPrimary: '#F0F2F7',
  textSecondary: '#A0A6B4',
  textTertiary: '#6A7080',
  textInverse: '#0F1117',
  textLink: '#5B8DEF',

  // Borders
  border: '#2C3038',
  borderLight: '#23262E',
  borderFocus: '#5B8DEF',

  // Primary brand
  primary: '#4CAF50',
  primaryHover: '#66BB6A',
  primaryPressed: '#388E3C',
  primarySurface: '#1B3A1C',
  primaryText: '#FFFFFF',

  // Secondary
  secondary: '#42A5F5',
  secondaryHover: '#64B5F6',
  secondarySurface: '#1A2A3A',
  secondaryText: '#FFFFFF',

  // Status colors
  safe: '#4CAF50',
  safeHover: '#66BB6A',
  safeSurface: '#1B3A1C',
  safeText: '#A5D6A7',

  pending: '#FFB300',
  pendingHover: '#FFC107',
  pendingSurface: '#3A3015',
  pendingText: '#FFE082',

  danger: '#EF5350',
  dangerHover: '#E57373',
  dangerSurface: '#3A1A1A',
  dangerText: '#EF9A9A',

  // Role accents
  roleAdmin: '#FF7043',
  roleManufacturer: '#BA68C8',
  roleCompany: '#42A5F5',
  roleStockist: '#26A69A',
};

// ============================================================
// COLOR HOOK
// ============================================

export function useColors() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  return isDark ? DarkColors : LightColors;
}

// ============================================================
// STATIC COLORS (for non-themed usage)
// ============================================

export const Colors = {
  ...LightColors,
  white: '#FFFFFF',
  text: {
    primary: LightColors.textPrimary,
    secondary: LightColors.textSecondary,
    tertiary: LightColors.textTertiary,
  },
  status: {
    safe: LightColors.safe,
    pending: LightColors.pending,
    danger: LightColors.danger,
  },
  roles: {
    admin: LightColors.roleAdmin,
    manufacturer: LightColors.roleManufacturer,
    company: LightColors.roleCompany,
    stockist: LightColors.roleStockist,
  },
};

// ============================================================
// SPACING SCALE
// ============================================

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  xxl4: 64,
} as const;

// ============================================================
// BORDER RADIUS
// ============================================

export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

// ============================================================
// TYPOGRAPHY SYSTEM
// ============================================

import type { TextStyle } from 'react-native';

const fontVariant: TextStyle['fontVariant'] = ['tabular-nums'];

export const Typography = {
  display: {
    fontSize: 48,
    fontWeight: '800' as const,
    letterSpacing: -1,
    lineHeight: 56,
  },
  hero: {
    fontSize: 34,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
    lineHeight: 40,
  },
  h1: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
    lineHeight: 34,
  },
  h2: {
    fontSize: 22,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
    lineHeight: 28,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  h4: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 22,
  },
  bodyLarge: {
    fontSize: 18,
    fontWeight: '400' as const,
    lineHeight: 28,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
  },
  metadata: {
    fontSize: 11,
    fontWeight: '500' as const,
    lineHeight: 14,
    letterSpacing: 0.3,
  },
  button: {
    fontSize: 16,
    fontWeight: '600' as const,
    letterSpacing: 0.3,
  },
  buttonSmall: {
    fontSize: 14,
    fontWeight: '600' as const,
    letterSpacing: 0.2,
  },
  price: {
    fontSize: 24,
    fontWeight: '800' as const,
    fontVariant,
    lineHeight: 32,
  },
  priceSmall: {
    fontSize: 18,
    fontWeight: '700' as const,
    fontVariant,
    lineHeight: 24,
  },
  number: {
    fontSize: 40,
    fontWeight: '800' as const,
    fontVariant,
    lineHeight: 48,
  },
} as const;

// ============================================================
// SHADOWS (Light + Dark)
// ============================================

export const LightShadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 6,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
};

export const DarkShadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
  },
};

export function useShadows() {
  const colorScheme = useColorScheme();
  return colorScheme === 'dark' ? DarkShadows : LightShadows;
}

export const Shadows = LightShadows;

// ============================================================
// ANIMATION TOKENS
// ============================================

export const Animations = {
  duration: {
    instant: 100,
    fast: 150,
    normal: 250,
    slow: 400,
  },
  easing: {
    easeOut: 'easeOut',
    easeIn: 'easeIn',
    spring: 'spring',
  },
} as const;

// ============================================================
// BREAKPOINTS (Responsive)
// ============================================

export const Breakpoints = {
  mobile: 0,
  tablet: 600,
  laptop: 1024,
  desktop: 1440,
} as const;
