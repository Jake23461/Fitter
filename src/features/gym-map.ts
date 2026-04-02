import { supabase } from '../lib/supabase'
import { Gym, Post, PostMedia, Profile } from '../types'

export type MapPost = Pick<Post, 'id' | 'caption' | 'created_at' | 'gym_id'> & {
  gym: Gym | null
  profile: Pick<Profile, 'id' | 'username' | 'display_name'> | null
  post_media: PostMedia[]
}

type RawMapPost = Pick<Post, 'id' | 'caption' | 'created_at' | 'gym_id'> & {
  gym: Gym[] | Gym | null
  profile:
    | Array<Pick<Profile, 'id' | 'username' | 'display_name'>>
    | Pick<Profile, 'id' | 'username' | 'display_name'>
    | null
  post_media: PostMedia[]
}

export type GymMapItem = {
  gym: Gym
  posts: MapPost[]
  previewUrls: string[]
  latestPostAt: string
}

export type MapRegion = {
  latitude: number
  longitude: number
  latitudeDelta: number
  longitudeDelta: number
}

export const DEFAULT_REGION: MapRegion = {
  latitude: 51.5072,
  longitude: -0.1276,
  latitudeDelta: 0.22,
  longitudeDelta: 0.22,
}

export function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${Math.max(mins, 1)}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function getPublicPostMediaUrl(storagePath?: string | null) {
  return storagePath
    ? supabase.storage.from('post-media').getPublicUrl(storagePath).data.publicUrl
    : null
}

export async function fetchGymPhotoMap(): Promise<GymMapItem[]> {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('posts')
    .select('id, gym_id, caption, created_at, gym:gyms(*), profile:profiles(id, username, display_name), post_media!inner(*)')
    .eq('is_deleted', false)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) throw error

  const grouped = new Map<string, GymMapItem>()

  for (const rawPost of (data ?? []) as RawMapPost[]) {
    const gym = Array.isArray(rawPost.gym) ? rawPost.gym[0] ?? null : rawPost.gym
    const profile = Array.isArray(rawPost.profile) ? rawPost.profile[0] ?? null : rawPost.profile

    if (!gym || (gym.lat === 0 && gym.lng === 0)) continue

    const post: MapPost = {
      id: rawPost.id,
      gym_id: rawPost.gym_id,
      caption: rawPost.caption,
      created_at: rawPost.created_at,
      gym,
      profile,
      post_media: rawPost.post_media ?? [],
    }

    const photoMedia = post.post_media.filter((media) => media.media_type === 'photo' && !!media.storage_path)
    if (photoMedia.length === 0) continue

    const existing = grouped.get(post.gym_id)
    if (existing) {
      existing.posts.push({ ...post, post_media: photoMedia })
      for (const media of photoMedia) {
        const url = getPublicPostMediaUrl(media.storage_path)
        if (url && !existing.previewUrls.includes(url) && existing.previewUrls.length < 6) {
          existing.previewUrls.push(url)
        }
      }
      continue
    }

    grouped.set(post.gym_id, {
      gym,
      posts: [{ ...post, post_media: photoMedia }],
      previewUrls: photoMedia
        .slice(0, 6)
        .map((media) => getPublicPostMediaUrl(media.storage_path))
        .filter((url): url is string => !!url),
      latestPostAt: post.created_at,
    })
  }

  return Array.from(grouped.values()).sort(
    (a, b) => new Date(b.latestPostAt).getTime() - new Date(a.latestPostAt).getTime(),
  )
}
