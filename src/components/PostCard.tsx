import { useState } from 'react'
import { View, Text, Image, Pressable, StyleSheet, Dimensions, Alert } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { Post } from '../types'
import { Avatar } from './ui/Avatar'
import { Colors, Space, Type, Radii } from '../tokens'

const { width } = Dimensions.get('window')
const CARD_WIDTH = width - 16
const IMAGE_HEIGHT = CARD_WIDTH * 1.2

type Props = {
  post: Post
  onLikeToggle?: () => void
}

export function PostCard({ post, onLikeToggle }: Props) {
  if (!post) return null
  const { session } = useAuthStore()
  const [liked, setLiked] = useState(post.user_has_liked ?? false)
  const [likeCount, setLikeCount] = useState(post.like_count)

  const mediaUrl = post.post_media?.[0]?.storage_path
    ? supabase.storage.from('post-media').getPublicUrl(post.post_media[0].storage_path).data.publicUrl
    : null

  const avatarUrl = post.profile?.avatar_url
    ? supabase.storage.from('avatars').getPublicUrl(post.profile.avatar_url).data.publicUrl
    : null

  async function handleLike() {
    if (!session) return
    const newLiked = !liked
    setLiked(newLiked)
    setLikeCount((c) => c + (newLiked ? 1 : -1))
    if (newLiked) {
      await supabase.from('post_likes').insert({ post_id: post.id, user_id: session.user.id })
    } else {
      await supabase.from('post_likes').delete().match({ post_id: post.id, user_id: session.user.id })
    }
    onLikeToggle?.()
  }

  async function handleReport() {
    Alert.alert('Report Post', 'Why are you reporting this?', [
      { text: 'Spam or fake', onPress: () => submitReport('spam') },
      { text: 'Nudity or sexual content', onPress: () => submitReport('nudity') },
      { text: 'Harassment or hate', onPress: () => submitReport('harassment') },
      { text: 'Fake gym check-in', onPress: () => submitReport('fake_checkin') },
      { text: 'Other', onPress: () => submitReport('other') },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  async function submitReport(reason: string) {
    if (!session) return
    await supabase.from('reports').insert({
      reporter_id: session.user.id,
      post_id: post.id,
      reason,
      status: 'pending',
    })
    Alert.alert('Reported', "Thanks for your report. We'll review it shortly.")
  }

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h`
    return `${Math.floor(hours / 24)}d`
  }

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/post/${post.id}`)}>
      {/* Image with overlaid user info */}
      <View style={styles.imageContainer}>
        {mediaUrl ? (
          <Image source={{ uri: mediaUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder} />
        )}

        {/* Bottom scrim overlay */}
        <View style={styles.scrim} pointerEvents="none" />

        {/* User info overlaid on image */}
        <View style={styles.imageOverlay} pointerEvents="box-none">
          <Pressable
            style={styles.userRow}
            onPress={() => router.push(`/profile/${post.user_id}`)}
          >
            <Avatar
              uri={avatarUrl ?? undefined}
              initials={post.profile?.display_name?.[0]?.toUpperCase() ?? '?'}
              size="sm"
              isActive={false}
            />
            <View style={styles.userInfo}>
              <Text style={styles.displayName}>{post.profile?.display_name ?? 'User'}</Text>
              <Text style={styles.meta}>📍 {post.gym?.name ?? 'Gym'} · {timeAgo(post.created_at)}</Text>
            </View>
          </Pressable>

          <Pressable style={styles.moreButton} onPress={handleReport} hitSlop={8}>
            <Text style={styles.moreButtonText}>···</Text>
          </Pressable>
        </View>
      </View>

      {/* Actions + caption below image */}
      <View style={styles.footer}>
        <View style={styles.actions}>
          <Pressable style={styles.actionButton} onPress={handleLike}>
            <Text style={styles.actionIcon}>{liked ? '🔥' : '🤍'}</Text>
            <Text style={[styles.actionCount, liked && styles.actionCountActive]}>
              {likeCount > 0 ? likeCount : ''}
            </Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => router.push(`/post/${post.id}`)}>
            <Text style={styles.actionIcon}>💬</Text>
            <Text style={styles.actionCount}>
              {post.comment_count > 0 ? post.comment_count : ''}
            </Text>
          </Pressable>
        </View>

        {post.caption ? (
          <Text style={styles.caption} numberOfLines={2}>
            <Text style={styles.captionName}>{post.profile?.display_name ?? 'User'} </Text>
            {post.caption}
          </Text>
        ) : null}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    alignSelf: 'center',
    marginBottom: Space.lg,
    borderRadius: Radii.xl,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  imageContainer: {
    width: CARD_WIDTH,
    height: IMAGE_HEIGHT,
    position: 'relative',
  },
  image: {
    width: CARD_WIDTH,
    height: IMAGE_HEIGHT,
  },
  imagePlaceholder: {
    width: CARD_WIDTH,
    height: IMAGE_HEIGHT,
    backgroundColor: Colors.surface,
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 110,
    backgroundColor: Colors.overlayScrim,
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Space.md,
    paddingTop: Space.md,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    flex: 1,
    paddingRight: Space.sm,
  },
  userInfo: { flex: 1 },
  displayName: { ...Type.username, color: Colors.textPrimary },
  meta: { ...Type.caption, color: Colors.overlayMeta, marginTop: 1 },
  moreButton: { padding: Space.xs },
  moreButtonText: { ...Type.heading, color: Colors.overlayMeta, letterSpacing: 2 },
  footer: {
    paddingHorizontal: Space.md,
    paddingTop: Space.sm,
    paddingBottom: Space.md,
  },
  actions: {
    flexDirection: 'row',
    gap: Space.lg,
    marginBottom: Space.sm,
  },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: Space.xs },
  actionIcon: {},
  actionCount: { ...Type.body, color: Colors.textSecondary, minWidth: 12 },
  actionCountActive: { color: Colors.accent },
  caption: { ...Type.body, color: Colors.textPrimary },
  captionName: { ...Type.username, color: Colors.textPrimary },
})
