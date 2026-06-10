import { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { getTheme } from '../theme'
import type { BadgeDefinition, UIVariant } from '../../packages/types'

interface Props {
  badge: BadgeDefinition | null
  variant: UIVariant
  onDone: () => void
}

export function BadgeToast({ badge, variant, onDone }: Props) {
  const opacity = useRef(new Animated.Value(0)).current
  const theme = getTheme(variant)
  const s = styles(theme)

  useEffect(() => {
    if (!badge) return
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => onDone())
  }, [badge?.key])

  if (!badge) return null

  return (
    <Animated.View style={[s.toast, { opacity }]} pointerEvents="none">
      <Text style={s.emoji}>{badge.emoji}</Text>
      <View>
        <Text style={s.label}>Nova medalha: {badge.label}</Text>
        <Text style={s.desc}>{badge.description}</Text>
      </View>
    </Animated.View>
  )
}

function styles(t: ReturnType<typeof getTheme>) {
  return StyleSheet.create({
    toast: {
      position: 'absolute',
      top: 16,
      left: 16,
      right: 16,
      backgroundColor: t.text,
      borderRadius: t.radius,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      zIndex: 100,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 8,
      elevation: 6,
    },
    emoji: { fontSize: 28 },
    label: { fontSize: t.fontSizeBody, fontWeight: '700', color: '#fff' },
    desc: { fontSize: t.fontSizeBody - 2, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  })
}
