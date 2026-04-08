import { useEffect } from 'react'
import { Stack, router } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { supabase } from '../src/lib/supabase'
import { useAuthStore } from '../src/stores/authStore'
import { useSessionStore } from '../src/stores/sessionStore'

const queryClient = new QueryClient()

export default function RootLayout() {
  const { session, loading, setSession, fetchProfile, setLoading } = useAuthStore()
  const { fetchActiveSession } = useSessionStore()

  useEffect(() => {
    let hydrated = false
    let activeUserId: string | null = null

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user.id ?? null
      if (activeUserId !== nextUserId) {
        queryClient.clear()
        activeUserId = nextUserId
      }

      setSession(session)

      if (event === 'SIGNED_IN') {
        if (session?.user) {
          fetchProfile(session.user.id)
          fetchActiveSession(session.user.id)
        }
        if (!hydrated) { hydrated = true; setLoading(false) }
        router.replace('/(tabs)/feed')
        return
      }

      if (event === 'SIGNED_OUT') {
        if (!hydrated) { hydrated = true; setLoading(false) }
        useSessionStore.getState().reset()
        router.replace('/(auth)/welcome')
        return
      }

      // INITIAL_SESSION — app cold start with existing session
      // index.tsx handles the initial redirect; no need to router.replace here
      if (event === 'INITIAL_SESSION') {
        if (session?.user) {
          fetchProfile(session.user.id)
          fetchActiveSession(session.user.id)
        }
        if (!hydrated) { hydrated = true; setLoading(false) }
      }

      // TOKEN_REFRESHED — just update session, no nav or extra fetches
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!hydrated) {
        activeUserId = session?.user.id ?? null
        setSession(session)
        if (session?.user) {
          fetchProfile(session.user.id)
          fetchActiveSession(session.user.id)
        }
        hydrated = true
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return null

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="post/[id]"
          options={{
            presentation: 'transparentModal',
            animation: 'none',
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen name="profile/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="create-post" options={{ presentation: 'modal' }} />
        <Stack.Screen name="edit-profile" options={{ presentation: 'modal' }} />
        <Stack.Screen name="edit-stats" options={{ presentation: 'modal' }} />
        <Stack.Screen name="create-workout" options={{ presentation: 'modal' }} />
        <Stack.Screen name="people-search" options={{ presentation: 'card' }} />
      </Stack>
    </QueryClientProvider>
  )
}
