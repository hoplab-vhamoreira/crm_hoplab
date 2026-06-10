import { Stack } from 'expo-router'

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="consent" />
      <Stack.Screen name="link-therapist" />
    </Stack>
  )
}
