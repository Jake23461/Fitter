import { router } from 'expo-router'

export function openProfile(targetUserId: string, currentUserId?: string | null) {
  if (!targetUserId) return

  if (currentUserId && targetUserId === currentUserId) {
    router.push('/(tabs)/profile')
    return
  }

  router.push(`/profile/${targetUserId}` as never)
}
