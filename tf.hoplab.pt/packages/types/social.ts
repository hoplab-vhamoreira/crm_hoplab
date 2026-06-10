export interface Message {
  id: string
  sender_id: string
  recipient_id: string
  link_id: string
  body: string
  read_at: string | null
  created_at: string
}

export type MessageInsert = Omit<Message, 'id' | 'created_at' | 'read_at'>

export interface Streak {
  id: string
  patient_id: string
  current_streak: number
  longest_streak: number
  last_active_date: string | null
  total_sessions: number
  updated_at: string
}

export interface Badge {
  id: string
  patient_id: string
  badge_key: string
  earned_at: string
}

/** Definições locais de medalhas — texto motivacional, nunca clínico */
export interface BadgeDefinition {
  key: string
  label: string
  emoji: string
  description: string       // ex: "7 dias seguidos"
  threshold: number         // valor numérico que despoleta a medalha
  type: 'streak' | 'total_sessions'
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  { key: 'first_done',    label: 'Primeiro passo',  emoji: '🌱', description: '1.ª sessão concluída',    threshold: 1,  type: 'total_sessions' },
  { key: 'sessions_5',   label: '5 sessões',        emoji: '⭐', description: '5 sessões no total',      threshold: 5,  type: 'total_sessions' },
  { key: 'sessions_10',  label: '10 sessões',       emoji: '🌟', description: '10 sessões no total',     threshold: 10, type: 'total_sessions' },
  { key: 'sessions_25',  label: '25 sessões',       emoji: '🏆', description: '25 sessões no total',     threshold: 25, type: 'total_sessions' },
  { key: 'streak_3',     label: '3 dias seguidos',  emoji: '🔥', description: '3 dias consecutivos',     threshold: 3,  type: 'streak' },
  { key: 'streak_7',     label: 'Semana completa',  emoji: '💎', description: '7 dias consecutivos',     threshold: 7,  type: 'streak' },
  { key: 'streak_14',   label: '2 semanas',         emoji: '🚀', description: '14 dias consecutivos',    threshold: 14, type: 'streak' },
  { key: 'streak_30',   label: 'Mês inteiro',       emoji: '👑', description: '30 dias consecutivos',    threshold: 30, type: 'streak' },
]
