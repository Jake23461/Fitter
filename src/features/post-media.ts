import { supabase } from '../lib/supabase'
import type { PostMedia } from '../types'

function inferMediaRank(storagePath: string) {
  const normalized = storagePath.toLowerCase()
  if (normalized.includes('-back.')) return 0
  if (normalized.includes('-front.')) return 1
  return 2
}

export function sortPostMedia(media: PostMedia[] = []) {
  return [...media].sort((a, b) => {
    const rankDiff = inferMediaRank(a.storage_path) - inferMediaRank(b.storage_path)
    if (rankDiff !== 0) return rankDiff
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
}

export function getPostMediaUrl(storagePath?: string | null) {
  return storagePath
    ? supabase.storage.from('post-media').getPublicUrl(storagePath).data.publicUrl
    : null
}

export function getDualSnapAssets(media: PostMedia[] = []) {
  const ordered = sortPostMedia(media)
  return {
    primary: ordered[0] ?? null,
    secondary: ordered[1] ?? null,
    ordered,
  }
}
