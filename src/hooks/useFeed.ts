import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Post } from '../types'

const POSTS_PER_PAGE = 20

export function useFeed(tab: 'foryou' | 'gym', gymId?: string) {
  return useQuery({
    queryKey: ['feed', tab, gymId],
    queryFn: async () => {
      let query = supabase
        .from('posts')
        .select(
          `
          *,
          profile:profiles(id, display_name, avatar_url, streak_current, home_gym_id),
          gym:gyms(id, name, city),
          post_media(*)
        `
        )
        .order('created_at', { ascending: false })
        .limit(POSTS_PER_PAGE)

      if (tab === 'gym' && gymId) {
        query = query.eq('gym_id', gymId)
      }

      const { data, error } = await query
      if (error) throw error

      return (data || []) as Post[]
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}
