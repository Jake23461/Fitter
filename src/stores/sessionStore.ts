import { create } from 'zustand'
import { GymSession } from '../types'
import { supabase } from '../lib/supabase'

type SessionStore = {
  activeSession: GymSession | null
  setActiveSession: (session: GymSession | null) => void
  fetchActiveSession: (userId: string) => Promise<void>
  checkOut: () => Promise<void>
  reset: () => void
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  activeSession: null,

  setActiveSession: (session) => set({ activeSession: session }),

  fetchActiveSession: async (userId: string) => {
    const { data } = await supabase
      .from('gym_sessions')
      .select('*, gym:gyms(*)')
      .eq('user_id', userId)
      .is('checked_out_at', null)
      .maybeSingle()

    set({ activeSession: data ?? null })
  },

  checkOut: async () => {
    const session = get().activeSession
    if (!session) return

    await supabase
      .from('gym_sessions')
      .update({ checked_out_at: new Date().toISOString() })
      .eq('id', session.id)

    set({ activeSession: null })
  },

  reset: () => set({ activeSession: null }),
}))
