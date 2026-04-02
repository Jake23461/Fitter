import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image,
  StatusBar, RefreshControl, Dimensions, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../src/lib/supabase'
import { BrandWordmark } from '../../src/components/BrandWordmark'
import { useAuthStore } from '../../src/stores/authStore'
import { useSessionStore } from '../../src/stores/sessionStore'
import { Colors, Space, Radii, Type } from '../../src/tokens'
import { getDualSnapAssets, getPostMediaUrl } from '../../src/features/post-media'
import type { Post, Profile } from '../../src/types'

type FeedTab = 'trending' | 'friends' | 'nearby'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

function AppHeader({ avatarUrl }: { avatarUrl?: string | null }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} activeOpacity={0.8}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.headerAvatar} />
        ) : (
          <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
            <Ionicons name="person" size={14} color={Colors.textMuted} />
          </View>
        )}
      </TouchableOpacity>
      <View style={styles.headerCenter}>
        <Text style={styles.headerEyebrow}>TODAY'S CHECK-INS</Text>
        <BrandWordmark color={Colors.textPrimary} />
      </View>
      <TouchableOpacity activeOpacity={0.7}>
        <Ionicons name="search" size={22} color={Colors.textSecondary} />
      </TouchableOpacity>
    </View>
  )
}

function LockedPreviewCard({ post }: { post: Post }) {
  const { ordered } = getDualSnapAssets(post.post_media)
  const primaryUrl = getPostMediaUrl(ordered[0]?.storage_path)
  const secondaryUrl = getPostMediaUrl(ordered[1]?.storage_path)

  return (
    <View style={styles.lockedPreviewCard}>
      <View style={styles.lockedPreviewHeader}>
        <Text style={styles.lockedPreviewName}>
          {(post.profile?.display_name ?? post.profile?.username ?? 'FITTER').toUpperCase()}
        </Text>
        <Text style={styles.lockedPreviewMeta}>
          {post.gym?.name?.toUpperCase() ?? 'GYM SESSION'}
        </Text>
      </View>

      <View style={styles.lockedPreviewFrame}>
        {primaryUrl ? (
          <Image source={{ uri: primaryUrl }} style={styles.lockedPreviewPrimary} resizeMode="cover" blurRadius={18} />
        ) : (
          <View style={[styles.lockedPreviewPrimary, styles.snapFallback]}>
            <Ionicons name="image-outline" size={28} color={Colors.textMuted} />
          </View>
        )}

        {secondaryUrl && (
          <Image source={{ uri: secondaryUrl }} style={styles.lockedPreviewSecondary} resizeMode="cover" blurRadius={18} />
        )}

        <View style={styles.lockedPreviewOverlay}>
          <Ionicons name="eye-off-outline" size={18} color={Colors.textPrimary} />
        </View>
      </View>
    </View>
  )
}

function LockedFeed({
  posts,
  hasActiveSession,
}: {
  posts: Post[]
  hasActiveSession: boolean
}) {
  const title = hasActiveSession ? 'FINISH TODAY\'S CHECK-IN' : 'CHECK IN TO UNLOCK'
  const body = hasActiveSession
    ? 'Your camera is ready, but today is not counted until you upload your snap. Post it to unlock everyone else\'s check-ins.'
    : 'Every day starts with a gym check-in snap. Until you post today\'s snap, everyone else stays blurred.'
  const ctaLabel = hasActiveSession ? 'TAKE TODAY\'S SNAP' : 'START CHECK-IN'

  return (
    <ScrollView contentContainerStyle={styles.lockedScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.lockCard}>
        <View style={styles.lockIconWrap}>
          <Ionicons name={hasActiveSession ? 'camera' : 'lock-closed'} size={28} color={Colors.accent} />
        </View>
        <Text style={styles.lockTitle}>{title}</Text>
        <Text style={styles.lockBody}>{body}</Text>
        <TouchableOpacity
          style={styles.checkinCta}
          activeOpacity={0.85}
          onPress={() => router.push('/(tabs)/checkin')}
        >
          <Text style={styles.checkinCtaText}>{ctaLabel}</Text>
        </TouchableOpacity>
      </View>

      {posts.slice(0, 3).map(post => <LockedPreviewCard key={post.id} post={post} />)}
    </ScrollView>
  )
}

function StoryCircle({ profile, isSelf }: { profile: Profile | null; isSelf?: boolean }) {
  const avatarUrl = profile?.avatar_url
    ? supabase.storage.from('avatars').getPublicUrl(profile.avatar_url).data.publicUrl
    : null

  return (
    <TouchableOpacity style={styles.storyItem} activeOpacity={0.8}>
      <View style={[styles.storyRing, isSelf && styles.storyRingActive]}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.storyAvatar} />
        ) : (
          <View style={[styles.storyAvatar, styles.storyAvatarFallback]}>
            <Ionicons name="person" size={16} color={Colors.textMuted} />
          </View>
        )}
      </View>
      <Text style={styles.storyLabel} numberOfLines={1}>
        {isSelf ? 'YOU' : (profile?.username ?? '').toUpperCase()}
      </Text>
    </TouchableOpacity>
  )
}

function PostCard({ post }: { post: Post }) {
  const [liked, setLiked] = useState(post.user_has_liked ?? false)
  const [likeCount, setLikeCount] = useState(post.like_count)
  const [isInsetExpanded, setIsInsetExpanded] = useState(false)
  const { session } = useAuthStore()

  const avatarUrl = post.profile?.avatar_url
    ? supabase.storage.from('avatars').getPublicUrl(post.profile.avatar_url).data.publicUrl
    : null

  const { ordered } = getDualSnapAssets(post.post_media)
  const primaryMedia = isInsetExpanded ? ordered[1] ?? ordered[0] ?? null : ordered[0] ?? null
  const secondaryMedia = isInsetExpanded ? ordered[0] ?? null : ordered[1] ?? null
  const primaryUrl = getPostMediaUrl(primaryMedia?.storage_path)
  const secondaryUrl = getPostMediaUrl(secondaryMedia?.storage_path)

  async function handleReport(reason: string) {
    if (!session) return
    await supabase.from('reports').insert({
      reporter_id: session.user.id,
      post_id: post.id,
      reason,
    })
    Alert.alert('Reported', 'Thanks for keeping the community safe.')
  }

  async function handleLike() {
    if (!session) return
    const next = !liked
    setLiked(next)
    setLikeCount(c => next ? c + 1 : c - 1)
    if (next) {
      await supabase.from('post_likes').insert({ post_id: post.id, user_id: session.user.id })
    } else {
      await supabase.from('post_likes').delete()
        .eq('post_id', post.id).eq('user_id', session.user.id)
    }
  }

  return (
    <View style={styles.postCard}>
      <View style={styles.postAuthorRow}>
        <TouchableOpacity
          onPress={() => router.push(`/profile/${post.user_id}` as never)}
          activeOpacity={0.8}
          style={styles.postAuthorTap}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.postAvatar} />
          ) : (
            <View style={[styles.postAvatar, styles.postAvatarFallback]}>
              <Ionicons name="person" size={14} color={Colors.textMuted} />
            </View>
          )}
          <View style={styles.postAuthorInfo}>
            <Text style={styles.postUsername}>{post.profile?.display_name ?? post.profile?.username ?? 'unknown'}</Text>
            <Text style={styles.postMetaLine}>
              @{post.profile?.username ?? 'unknown'}
              {post.gym ? `  •  ${post.gym.name}` : ''}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            Alert.alert('Report Post', 'Why are you reporting this?', [
              { text: 'Spam', onPress: () => handleReport('spam') },
              { text: 'Inappropriate', onPress: () => handleReport('nudity') },
              { text: 'Harassment', onPress: () => handleReport('harassment') },
              { text: 'Cancel', style: 'cancel' },
            ])
          }}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.snapFrame}>
        <TouchableOpacity
          activeOpacity={0.96}
          onPress={() => router.push(`/post/${post.id}` as never)}
        >
          {primaryUrl ? (
            <Image source={{ uri: primaryUrl }} style={styles.primarySnap} resizeMode="cover" />
          ) : (
            <View style={[styles.primarySnap, styles.snapFallback]}>
              <Ionicons name="image-outline" size={28} color={Colors.textMuted} />
            </View>
          )}
        </TouchableOpacity>

        {secondaryUrl && (
          <TouchableOpacity
            style={styles.secondarySnapWrap}
            activeOpacity={0.9}
            onPress={() => setIsInsetExpanded((current) => !current)}
          >
            <Image source={{ uri: secondaryUrl }} style={styles.secondarySnap} resizeMode="cover" />
            <View style={styles.secondaryHint}>
              <Ionicons name="expand-outline" size={14} color={Colors.textPrimary} />
            </View>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.postFooter}>
        <View style={styles.postActions}>
          <TouchableOpacity onPress={handleLike} style={styles.actionBtn} activeOpacity={0.7}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={22}
              color={liked ? Colors.accent : Colors.textSecondary}
            />
            <Text style={styles.actionCount}>{likeCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.7}
            onPress={() => router.push(`/post/${post.id}` as never)}
          >
            <Ionicons name="chatbubble-outline" size={20} color={Colors.textSecondary} />
            <Text style={styles.actionCount}>{post.comment_count}</Text>
          </TouchableOpacity>
        </View>

        {post.caption ? (
          <Text style={styles.caption}>{post.caption}</Text>
        ) : (
          <Text style={styles.captionMuted}>No caption. Just the work.</Text>
        )}
      </View>
    </View>
  )
}

function UnlockedFeed({
  tab, setTab, posts, loading, onRefresh, profile,
}: {
  tab: FeedTab
  setTab: (t: FeedTab) => void
  posts: Post[]
  loading: boolean
  onRefresh: () => void
  profile: Profile | null
}) {
  const tabs: { key: FeedTab; label: string }[] = [
    { key: 'trending', label: 'TRENDING' },
    { key: 'friends', label: 'FRIENDS' },
    { key: 'nearby', label: 'NEARBY' },
  ]

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={Colors.accent} />}
      contentContainerStyle={styles.feedScroll}
    >
      <View style={styles.tabRow}>
        {tabs.map(t => (
          <TouchableOpacity key={t.key} style={styles.feedTab} onPress={() => setTab(t.key)} activeOpacity={0.7}>
            <Text style={[styles.feedTabText, tab === t.key && styles.feedTabTextActive]}>
              {t.label}
            </Text>
            {tab === t.key && <View style={styles.feedTabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storyRow}>
        <StoryCircle profile={profile} isSelf />
        {posts.slice(0, 8).map(p => (
          <StoryCircle key={p.id} profile={p.profile ?? null} />
        ))}
      </ScrollView>

      {posts.map(post => <PostCard key={post.id} post={post} />)}

      {posts.length === 0 && !loading && (
        <Text style={styles.emptyText}>No snaps yet. Check in and post your moment first.</Text>
      )}
    </ScrollView>
  )
}

export default function FeedScreen() {
  const { session, profile } = useAuthStore()
  const { activeSession } = useSessionStore()
  const [tab, setTab] = useState<FeedTab>('trending')
  const today = new Date().toISOString().split('T')[0]

  const { data: hasCompletedTodaysCheckin = false, isLoading: unlockLoading } = useQuery<boolean>({
    queryKey: ['feed-unlock', session?.user.id, today],
    queryFn: async () => {
      if (!session) return false
      const { data, error } = await supabase
        .from('posts')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('is_deleted', false)
        .eq('post_date', today)
        .limit(1)

      if (error) throw error
      return (data?.length ?? 0) > 0
    },
    enabled: !!session,
    staleTime: 60_000,
  })

  const { data: posts = [], isLoading, refetch } = useQuery<Post[]>({
    queryKey: ['feed', tab, session?.user.id],
    queryFn: async () => {
      if (!session) return []
      let query = supabase
        .from('posts')
        .select('*, profile:profiles(*), gym:gyms(*), post_media(*)')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(20)

      if (tab === 'friends') {
        const { data: friends } = await supabase
          .from('friendships')
          .select('following_id')
          .eq('follower_id', session.user.id)
        const ids = (friends ?? []).map(f => f.following_id)
        if (ids.length === 0) return []
        query = query.in('user_id', ids)
      }

      const { data, error } = await query
      if (error) throw error
      if (!data || data.length === 0) return []

      const { data: liked } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', session.user.id)
        .in('post_id', data.map(p => p.id))
      const likedSet = new Set((liked ?? []).map(l => l.post_id))
      return data.map(p => ({ ...p, user_has_liked: likedSet.has(p.id) }))
    },
    enabled: !!session,
    staleTime: 60_000,
  })

  const avatarUrl = profile?.avatar_url
    ? supabase.storage.from('avatars').getPublicUrl(profile.avatar_url).data.publicUrl
    : null
  const isFeedUnlocked = hasCompletedTodaysCheckin
  const showLockedFeed = !unlockLoading && !isFeedUnlocked

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <AppHeader avatarUrl={avatarUrl} />

      {!showLockedFeed ? (
        <UnlockedFeed
          tab={tab}
          setTab={setTab}
          posts={posts}
          loading={isLoading}
          onRefresh={refetch}
          profile={profile}
        />
      ) : (
        <LockedFeed posts={posts} hasActiveSession={!!activeSession} />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: Colors.accent },
  headerAvatarFallback: { backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { alignItems: 'center', gap: 2 },
  headerEyebrow: { fontSize: 9, color: Colors.textMuted, fontWeight: '800', letterSpacing: 1.8 },
  lockedScroll: { flexGrow: 1, padding: Space.lg, justifyContent: 'center' },
  lockCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.xl,
    padding: Space.xl,
    alignItems: 'center',
    gap: Space.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  lockIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockTitle: { fontSize: Type.xl, fontWeight: '900', color: Colors.textPrimary, letterSpacing: 2 },
  lockBody: { fontSize: Type.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  lockedPreviewCard: {
    marginTop: Space.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radii.xl,
    padding: Space.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Space.sm,
  },
  lockedPreviewHeader: { gap: 2 },
  lockedPreviewName: { color: Colors.textPrimary, fontSize: Type.sm, fontWeight: '800', letterSpacing: 1.2 },
  lockedPreviewMeta: { color: Colors.textMuted, fontSize: Type.xs, fontWeight: '700', letterSpacing: 1 },
  lockedPreviewFrame: {
    position: 'relative',
    borderRadius: Radii.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceElevated,
  },
  lockedPreviewPrimary: { width: '100%', height: SCREEN_WIDTH * 0.92 },
  lockedPreviewSecondary: {
    position: 'absolute',
    right: Space.md,
    bottom: Space.md,
    width: SCREEN_WIDTH * 0.22,
    height: SCREEN_WIDTH * 0.29,
    borderRadius: Radii.md,
    borderWidth: 2,
    borderColor: Colors.textPrimary,
  },
  lockedPreviewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13,13,13,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkinCta: {
    backgroundColor: Colors.accent,
    borderRadius: Radii.full,
    paddingVertical: Space.md,
    paddingHorizontal: Space['2xl'],
    width: '100%',
    alignItems: 'center',
  },
  checkinCtaText: { color: Colors.textPrimary, fontSize: Type.md, fontWeight: '800', letterSpacing: 2 },

  feedScroll: { paddingBottom: Space.xl },
  tabRow: { flexDirection: 'row', paddingHorizontal: Space.lg, paddingTop: Space.sm },
  feedTab: { flex: 1, alignItems: 'center', paddingVertical: Space.sm },
  feedTabText: { fontSize: Type.sm, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 1.5 },
  feedTabTextActive: { color: Colors.textPrimary },
  feedTabUnderline: { position: 'absolute', bottom: 0, left: Space.sm, right: Space.sm, height: 2, backgroundColor: Colors.accent, borderRadius: 1 },

  storyRow: { paddingHorizontal: Space.lg, paddingVertical: Space.md, gap: Space.md },
  storyItem: { alignItems: 'center', gap: Space.xs, width: 64 },
  storyRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyRingActive: { borderColor: Colors.accent },
  storyAvatar: { width: 52, height: 52, borderRadius: 26 },
  storyAvatarFallback: { backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  storyLabel: { fontSize: 9, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5, textAlign: 'center' },

  postCard: {
    marginHorizontal: Space.md,
    marginBottom: Space.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radii.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  postAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.md,
    paddingTop: Space.md,
    paddingBottom: Space.sm,
    gap: Space.sm,
  },
  postAuthorTap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  postAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: Colors.accent },
  postAvatarFallback: { backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  postAuthorInfo: { flex: 1 },
  postUsername: { fontSize: Type.md, fontWeight: '800', color: Colors.textPrimary },
  postMetaLine: { fontSize: Type.xs, color: Colors.textSecondary, marginTop: 2 },

  snapFrame: {
    position: 'relative',
    marginHorizontal: Space.sm,
    borderRadius: Radii.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceElevated,
  },
  primarySnap: { width: '100%', height: SCREEN_WIDTH * 1.05 },
  snapFallback: { alignItems: 'center', justifyContent: 'center' },
  secondarySnapWrap: {
    position: 'absolute',
    right: Space.md,
    bottom: Space.md,
    width: SCREEN_WIDTH * 0.24,
    height: SCREEN_WIDTH * 0.31,
    borderRadius: Radii.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.textPrimary,
    backgroundColor: Colors.surface,
  },
  secondarySnap: { width: '100%', height: '100%' },
  secondaryHint: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  postFooter: { paddingHorizontal: Space.md, paddingVertical: Space.md, gap: Space.sm },
  postActions: { flexDirection: 'row', gap: Space.lg },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: Space.xs },
  actionCount: { color: Colors.textSecondary, fontSize: Type.sm, fontWeight: '600' },
  caption: { color: Colors.textPrimary, fontSize: Type.sm, lineHeight: 20 },
  captionMuted: { color: Colors.textMuted, fontSize: Type.sm },

  emptyText: { color: Colors.textMuted, textAlign: 'center', marginTop: Space.xl, fontSize: Type.sm },
})
