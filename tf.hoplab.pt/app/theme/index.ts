import type { UIVariant } from '../../packages/types'

interface Theme {
  // Cores base
  background: string
  surface: string
  primary: string
  primaryText: string
  text: string
  textSecondary: string
  border: string
  success: string
  error: string
  // Tipografia
  fontSizeBody: number
  fontSizeTitle: number
  fontSizeHeading: number
  lineHeight: number
  // Espaçamento
  radius: number
  // Alvos de toque (mínimo 44pt — WCAG)
  touchTarget: number
}

export const themes: Record<UIVariant, Theme> = {
  // Adulto — limpo, denso em dados, neutro
  focus: {
    background: '#F8F9FB',
    surface: '#FFFFFF',
    primary: '#2563EB',
    primaryText: '#FFFFFF',
    text: '#111827',
    textSecondary: '#6B7280',
    border: '#E5E7EB',
    success: '#16A34A',
    error: '#DC2626',
    fontSizeBody: 15,
    fontSizeTitle: 17,
    fontSizeHeading: 22,
    lineHeight: 22,
    radius: 10,
    touchTarget: 44,
  },

  // Criança — cores vivas, gamificado
  adventure: {
    background: '#FFF7ED',
    surface: '#FFFFFF',
    primary: '#F97316',
    primaryText: '#FFFFFF',
    text: '#1C1917',
    textSecondary: '#78716C',
    border: '#FED7AA',
    success: '#22C55E',
    error: '#EF4444',
    fontSizeBody: 16,
    fontSizeTitle: 18,
    fontSizeHeading: 24,
    lineHeight: 24,
    radius: 16,
    touchTarget: 48,
  },

  // Sénior — acessibilidade máxima, alto contraste, letra grande
  calm: {
    background: '#FFFFFF',
    surface: '#F3F4F6',
    primary: '#1D4ED8',
    primaryText: '#FFFFFF',
    text: '#111827',
    textSecondary: '#374151',
    border: '#9CA3AF',
    success: '#15803D',
    error: '#B91C1C',
    fontSizeBody: 19,
    fontSizeTitle: 22,
    fontSizeHeading: 28,
    lineHeight: 30,
    radius: 8,
    touchTarget: 56,
  },
}

export function getTheme(variant: UIVariant): Theme {
  return themes[variant]
}
