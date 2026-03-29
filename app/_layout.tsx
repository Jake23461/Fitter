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
      if (session?.user) {
        fetchProfile(session.user.id)
        fetchActiveSession(session.user.id)
      }
      if (!hydrated) {
        hydrated = true
        setLoading(false)
      }
      if (event === 'SIGNED_OUT') {
        useSessionStore.getState().reset()
        router.replace('/(auth)/welcome')
      }
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
        <Stack.Screen name="add-gym" options={{ presentation: 'modal' }} />
        <Stack.Screen name="create-workout" options={{ presentation: 'modal' }} />
        <Stack.Screen name="search" options={{ presentation: 'modal' }} />
        <Stack.Screen name="active-workout" options={{ presentation: 'modal' }} />
      </Stack>
    </QueryClientProvider>
  )
}
