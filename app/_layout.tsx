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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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
        <Stack.Screen name="post/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="profile/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="create-post" options={{ presentation: 'modal' }} />
        <Stack.Screen name="log-pr" options={{ presentation: 'modal' }} />
        <Stack.Screen name="edit-profile" options={{ presentation: 'modal' }} />
      </Stack>
    </QueryClientProvider>
  )
}
