import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useNearbyGyms() {
  return useQuery({
    queryKey: ['nearby-gyms'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]

      const { data: gyms } = await supabase
        .from('gyms')
        .select('*')

      // Fetch active session counts for each gym
      if (!gyms) return []

      const gymsWithCounts = await Promise.all(
        gyms.map(async (gym) => {
          const { count } = await supabase
            .from('gym_sessions')
            .select('id', { count: 'exact', head: true })
            .eq('gym_id', gym.id)
            .eq('session_date', today)
            .is('checked_out_at', null)

          return {
            ...gym,
            activeCount: count ?? 0,
          }
        })
      )

      return gymsWithCounts
    },
    staleTime: 1000 * 60, // 1 minute
  })
}
