import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, FlatList } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { getTheme } from '../../theme'
import { useAuth } from '../../context/auth'
import { uiVariantForRole, BADGE_DEFINITIONS } from '../../../packages/types'
import { useStreak } from '../../lib/useStreak'
import type { AdherenceLog, Badge } from '../../../packages/types'

interface DaySummary {
  date: string
  count: number
  logs: AdherenceLog[]
}

export default function HistoryScreen() {
  const { profile } = useAuth()
  const variant = profile ? uiVariantForRole(profile.role) : 'focus'
  const theme = getTheme(variant)
  const s = styles(theme)

  const { streak, badges, loading: streakLoading } = useStreak(profile?.id ?? null)
  const [days, setDays] = useState<DaySummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.id) return
    supabase
      .schema('tf')
      .from('adherence_logs')
      .select('*')
      .eq('patient_id', profile.id)
      .eq('completed', true)
      .order('session_date', { ascending: false })
      .limit(60)
      .then(({ data }) => {
        const map = new Map<string, AdherenceLog[]>()
        ;(data ?? []).forEach(log => {
          const arr = map.get(log.session_date) ?? []
          arr.push(log)
          map.set(log.session_date, arr)
        })
        setDays(
          Array.from(map.entries()).map(([date, logs]) => ({
            date,
            count: logs.length,
            logs,
          }))
        )
        setLoading(false)
      })
  }, [profile?.id])

  function getBadgeDef(key: string) {
    return BADGE_DEFINITIONS.find(b => b.key === key)
  }

  return (
    <SafeAreaView style={s.safe}>
      <FlatList
        data={days}
        keyExtractor={d => d.date}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <View>
            {/* Streak */}
            <View style={s.streakCard}>
              <Text style={s.streakEmoji}>🔥</Text>
              <View>
                <Text style={s.streakNumber}>
                  {streak?.current_streak ?? 0}
                </Text>
                <Text style={s.streakLabel}>dias seguidos</Text>
              </View>
              <View style={s.streakDivider} />
              <View>
                <Text style={s.streakNumber}>{streak?.total_sessions ?? 0}</Text>
                <Text style={s.streakLabel}>sessões no total</Text>
              </View>
              <View style={s.streakDivider} />
              <View>
                <Text style={s.streakNumber}>{streak?.longest_streak ?? 0}</Text>
                <Text style={s.streakLabel}>melhor sequência</Text>
              </View>
            </View>

            {/* Medalhas */}
            {badges.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>As tuas medalhas</Text>
                <View style={s.badgesGrid}>
                  {badges.map(b => {
                    const def = getBadgeDef(b.badge_key)
                    if (!def) return null
                    return (
                      <View key={b.id} style={s.badgeCard}>
                        <Text style={s.badgeEmoji}>{def.emoji}</Text>
                        <Text style={s.badgeLabel}>{def.label}</Text>
                        <Text style={s.badgeDesc}>{def.description}</Text>
                      </View>
                    )
                  })}
                </View>
              </View>
            )}

            {/* Histórico */}
            <Text style={[s.sectionTitle, { marginTop: 8 }]}>Sessões realizadas</Text>
            {/* Aviso factual — sem interpretação clínica */}
            <Text style={s.factualNote}>
              Registo do que fizeste. A interpretação clínica é do teu terapeuta.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.dayRow}>
            <View style={s.dayLeft}>
              <Text style={s.dayDate}>{formatDate(item.date)}</Text>
              <Text style={s.dayCount}>{item.count} exercício{item.count !== 1 ? 's' : ''}</Text>
            </View>
            <View style={s.dotsRow}>
              {item.logs.map(log => (
                <View
                  key={log.id}
                  style={[
                    s.dot,
                    log.self_rating === 'easy'   && s.dotEasy,
                    log.self_rating === 'medium'  && s.dotMedium,
                    log.self_rating === 'hard'    && s.dotHard,
                  ]}
                />
              ))}
            </View>
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={s.center}>
              <Text style={s.muted}>Ainda não há sessões registadas.</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  )
}

function formatDate(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })
}

function styles(t: ReturnType<typeof getTheme>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    list: { padding: 20, paddingBottom: 40 },
    streakCard: {
      backgroundColor: t.surface,
      borderRadius: t.radius,
      padding: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: t.border,
    },
    streakEmoji: { fontSize: 32 },
    streakNumber: { fontSize: t.fontSizeHeading, fontWeight: '700', color: t.text },
    streakLabel: { fontSize: t.fontSizeBody - 3, color: t.textSecondary },
    streakDivider: { width: 1, height: 32, backgroundColor: t.border },
    section: { marginBottom: 20 },
    sectionTitle: {
      fontSize: t.fontSizeBody - 1,
      fontWeight: '700',
      color: t.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    badgeCard: {
      backgroundColor: t.surface,
      borderRadius: t.radius,
      borderWidth: 1,
      borderColor: t.border,
      padding: 12,
      alignItems: 'center',
      width: '30%',
    },
    badgeEmoji: { fontSize: 28, marginBottom: 4 },
    badgeLabel: { fontSize: t.fontSizeBody - 2, fontWeight: '600', color: t.text, textAlign: 'center' },
    badgeDesc: { fontSize: 10, color: t.textSecondary, textAlign: 'center', marginTop: 2 },
    factualNote: {
      fontSize: t.fontSizeBody - 2,
      color: t.textSecondary,
      fontStyle: 'italic',
      marginBottom: 12,
      lineHeight: t.lineHeight - 4,
    },
    dayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: t.surface,
      borderRadius: t.radius,
      borderWidth: 1,
      borderColor: t.border,
      padding: 14,
      marginBottom: 8,
      minHeight: t.touchTarget,
    },
    dayLeft: {},
    dayDate: { fontSize: t.fontSizeBody, fontWeight: '600', color: t.text },
    dayCount: { fontSize: t.fontSizeBody - 2, color: t.textSecondary },
    dotsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', maxWidth: 120 },
    dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: t.border },
    dotEasy: { backgroundColor: t.success },
    dotMedium: { backgroundColor: '#F59E0B' },
    dotHard: { backgroundColor: t.error },
    center: { alignItems: 'center', padding: 32 },
    muted: { fontSize: t.fontSizeBody, color: t.textSecondary, textAlign: 'center' },
  })
}
