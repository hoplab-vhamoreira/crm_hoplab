import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { AuthProvider, useAuth } from '../context/auth'

function RootNavigator() {
  const { session, profile, loading } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    const inAuthGroup = segments[0] === '(auth)'

    if (!session) {
      // Sem sessão → ir para welcome
      if (!inAuthGroup) router.replace('/(auth)/welcome')
    } else if (!profile) {
      // Sessão mas sem perfil → ir para onboarding
      if (!inAuthGroup) router.replace('/(auth)/welcome')
    } else {
      // Sessão + perfil → ir para app
      if (inAuthGroup) router.replace('/(app)/')
    }
  }, [session, profile, loading])

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <RootNavigator />
    </AuthProvider>
  )
}
