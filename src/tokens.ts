// Single source of truth for all design constants.
// Import: import { Colors, Space, Type, Radii, Glass, Shadows, Elevation, Duration, Layout } from '../tokens'

export const Colors = {
  // Base
  background: '#000000',
  surface: '#111111',
  surfaceElevated: '#1A1A1A',
  accent: '#E5183A',
  accentDim: '#B01230',
  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#888888',
  textMuted: '#555555',
  textOnAccent: '#FFFFFF',
  // Borders
  border: '#333333',
  borderActive: '#48484A',
  borderSubtle: 'rgba(255,255,255,0.12)',
  // Glass / Overlay
  glassOverlay: 'rgba(0,0,0,0.75)',
  glassTint: 'rgba(255,255,255,0.08)',
  glassSpecular: 'rgba(255,255,255,0.22)',
  overlayScrim: 'rgba(0,0,0,0.38)',
  overlayMeta: 'rgba(255,255,255,0.50)',
  // BlurView tint (string literal — used as expo-blur tint prop)
  blurTint: 'systemUltraThinMaterialDark' as const,
  // Semantic
  destructive: '#E5183A',
  success: '#34C759',
  warning: '#FF9F0A',
  // Skeleton
  skeletonBase: '#1A1A1A',
  skeletonHighlight: 'rgba(255,255,255,0.06)',
} as const

export const Space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const

export const Type = {
  display:  { fontSize: 32, fontWeight: '700' as const, lineHeight: 38 },
  heading:  { fontSize: 20, fontWeight: '700' as const, lineHeight: 26 },
  body:     { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  username: { fontSize: 14, fontWeight: '700' as const, lineHeight: 20, letterSpacing: 0.1 },
  label:    { fontSize: 12, fontWeight: '700' as const, lineHeight: 16, letterSpacing: 0.1 },
  caption:  { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
} as const

export const Radii = {
  xs:   6,
  sm:   10,
  md:   14,
  lg:   16,
  xl:   24,
  '2xl': 32,
  full: 9999,
} as const

export const Glass = {
  subtle:  30,
  card:    60,
  overlay: 80,
  tabBar:  90,
} as const

export const Shadows = {
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16 },
} as const

export const Elevation = {
  sm: 2,
  md: 6,
  lg: 12,
} as const

export const Duration = {
  fast:     150,
  normal:   220,
  slow:     350,
  skeleton: 1200,
} as const

export const Layout = {
  screenPadding:   16,
  cardInset:       8,
  avatarSm:        32,
  avatarMd:        40,
  avatarLg:        80,
  tabBarHeight:    80,
  cardAspectRatio: 1.2,
} as const
