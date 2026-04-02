import { create } from 'zustand'
import { Session } from '@supabase/supabase-js'
import { Profile } from '../types'
import { supabase } from '../lib/supabase'
import { useSessionStore } from './sessionStore'

type AuthStore = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  setSession: (session: Session | null) => void
  setProfile: (profile: Profile | null) => void
  setLoading: (loading: boolean) => void
  fetchProfile: (userId: string) => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthStore>((set) => ({
  session: null,
  profile: null,
  loading: true,

  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),

  fetchProfile: async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (data) set({ profile: data })
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    useSessionStore.getState().reset()
    set({ session: null, profile: null })
  },
}))
