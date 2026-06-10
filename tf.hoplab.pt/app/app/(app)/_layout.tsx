import { Text } from 'react-native'
import { Tabs } from 'expo-router'
import { useAuth } from '../../context/auth'
import { uiVariantForRole } from '../../../packages/types'
import { getTheme } from '../../theme'

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.6 }}>{emoji}</Text>
}

export default function AppLayout() {
  const { profile } = useAuth()
  const variant = profile ? uiVariantForRole(profile.role) : 'focus'
  const theme = getTheme(variant)

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          height: theme.touchTarget + 20,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: theme.fontSizeBody - 3, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hoje',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plano',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📅" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Histórico',
          tabBarIcon: ({ focused }) => <TabIcon emoji="⭐" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Mensagens',
          tabBarIcon: ({ focused }) => <TabIcon emoji="💬" focused={focused} />,
        }}
      />
      {/* Ecrã de detalhe — não aparece na tab bar */}
      <Tabs.Screen
        name="exercise"
        options={{ href: null }}
      />
    </Tabs>
  )
}
