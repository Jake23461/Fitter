import { supabase } from '../lib/supabase'
import type {
  Post,
  ProfilePrivacySettings,
  ProfileVisibility,
  PrEntry,
  SocialRelationship,
  UserStats,
  WorkoutTemplate,
} from '../types'

export const DEFAULT_PROFILE_PRIVACY: Omit<ProfilePrivacySettings, 'user_id' | 'updated_at'> = {
  stats_visibility: 'public',
  calendar_visibility: 'public',
  saved_visibility: 'private',
  workouts_visibility: 'private',
}

export const profilePrivacyKeys = {
  settings: (userId: string | undefined) => ['profile-privacy', 'settings', userId] as const,
  userStats: (viewerId: string | undefined, userId: string | undefined) => ['profile-privacy', 'user-stats', viewerId, userId] as const,
  prs: (viewerId: string | undefined, userId: string | undefined) => ['profile-privacy', 'prs', viewerId, userId] as const,
  saved: (viewerId: string | undefined, userId: string | undefined) => ['profile-privacy', 'saved', viewerId, userId] as const,
  workouts: (viewerId: string | undefined, userId: string | undefined) => ['profile-privacy', 'workouts', viewerId, userId] as const,
  history: (viewerId: string | undefined, userId: string | undefined, year: number, month: number) => ['profile-privacy', 'history', viewerId, userId, year, month] as const,
}

export function getDefaultProfilePrivacySettings(userId: string): ProfilePrivacySettings {
  return {
    user_id: userId,
    ...DEFAULT_PROFILE_PRIVACY,
    updated_at: new Date(0).toISOString(),
  }
}

export async function fetchProfilePrivacySettings(userId: string): Promise<ProfilePrivacySettings> {
  const { data, error } = await supabase
    .from('profile_privacy_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    if (error.code === 'PGRST205' || error.message.toLowerCase().includes('profile_privacy_settings')) {
      return getDefaultProfilePrivacySettings(userId)
    }
    throw error
  }

  return data ?? getDefaultProfilePrivacySettings(userId)
}

export function canViewProfileSection({
  isSelf,
  relationship,
  visibility,
}: {
  isSelf: boolean
  relationship?: SocialRelationship
  visibility: ProfileVisibility
}) {
  if (isSelf) return true
  if (visibility === 'public') return true
  if (visibility === 'friends') return !!relationship?.isFriend
  return false
}

export function getVisibilityLabel(visibility: ProfileVisibility) {
  if (visibility === 'public') return 'PUBLIC'
  if (visibility === 'friends') return 'FRIENDS'
  return 'PRIVATE'
}

export function getLockedSectionCopy(visibility: ProfileVisibility, isSelf: boolean) {
  if (isSelf) return 'Only you can see this section.'
  if (visibility === 'friends') return 'Visible to friends only.'
  return 'This section is private.'
}

export async function upsertProfilePrivacySettings(settings: Omit<ProfilePrivacySettings, 'updated_at'>) {
  const { error } = await supabase
    .from('profile_privacy_settings')
    .upsert(settings, { onConflict: 'user_id' })

  if (error) throw error
}

export async function fetchUserStats(userId: string): Promise<UserStats | null> {
  const { data, error } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data ?? null
}

export async function fetchUserPrs(userId: string): Promise<PrEntry[]> {
  const { data, error } = await supabase
    .from('pr_entries')
    .select('*')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(20)

  if (error) {
    if (error.code === '42501') return []
    throw error
  }
  return data ?? []
}

export async function fetchUserSavedPosts(userId: string): Promise<Post[]> {
  const { data, error } = await supabase
    .from('saved_workouts')
    .select('post:posts(*, post_media(*))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    if (error.code === '42501') return []
    throw error
  }
  return ((data ?? []) as unknown as Array<{ post: Post | Post[] | null }>)
    .map((row) => Array.isArray(row.post) ? row.post[0] ?? null : row.post)
    .filter(Boolean) as Post[]
}

export async function fetchUserWorkoutTemplates(userId: string): Promise<WorkoutTemplate[]> {
  const { data, error } = await supabase
    .from('workout_templates')
    .select('*, exercises:workout_template_exercises(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    if (error.code === '42501') return []
    throw error
  }
  return data ?? []
}
