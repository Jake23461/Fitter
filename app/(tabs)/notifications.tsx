import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, Alert, StatusBar,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { supabase } from '../../src/lib/supabase'
import { BrandWordmark } from '../../src/components/BrandWordmark'
import { openProfile } from '../../src/features/profile-navigation'
import {
  getSocialActionLabel,
  invalidateSocialState,
  showSocialError,
  toggleFollow,
} from '../../src/features/social'
import { useAuthStore } from '../../src/stores/authStore'
import { Colors, Space, Radii, Type } from '../../src/tokens'
import type { Notification, SocialRelationship } from '../../src/types'

function formatRelative(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'JUST NOW'
  if (mins < 60) return `${mins} MINUTES AGO`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} HOURS AGO`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'YESTERDAY'
  return `${days} DAYS AGO`
}

function NotifIcon({ type }: { type: Notification['type'] }) {
  const map: Record<Notification['type'], { name: React.ComponentProps<typeof Ionicons>['name']; color: string }> = {
    like: { name: 'heart', color: Colors.accent },
    comment: { name: 'chatbubble', color: Colors.accent },
    follow: { name: 'person-add', color: Colors.textSecondary },
    achievement: { name: 'trophy', color: '#F5A623' },
  }
  const cfg = map[type]
  return (
    <View style={styles.notifIconWrap}>
      <Ionicons name={cfg.name} size={18} color={cfg.color} />
    </View>
  )
}

function NotifCard({
  item,
  relationship,
  onFollowAction,
}: {
  item: Notification
  relationship?: SocialRelationship
  onFollowAction: (actorId: string, isFollowing: boolean) => void
}) {
  const avatarUrl = item.actor?.avatar_url
    ? supabase.storage.from('avatars').getPublicUrl(item.actor.avatar_url).data.publicUrl
    : null

  const postThumbUrl = item.post_id
    ? null // would need post media lookup — skip for now
    : null

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => {
        if (item.post_id) {
          router.push(`/post/${item.post_id}` as never)
          return
        }

        if (item.actor_id) openProfile(item.actor_id)
      }}
    >
      {/* Left accent bar */}
      {!item.is_read && <View style={styles.unreadBar} />}

      {/* Avatar + icon overlay */}
      <View style={styles.cardLeft}>
        <View style={styles.avatarWrap}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <NotifIcon type={item.type} />
            </View>
          )}
          {avatarUrl && (
            <View style={styles.iconOverlay}>
              <NotifIcon type={item.type} />
            </View>
          )}
        </View>
      </View>

      {/* Body */}
      <View style={styles.cardBody}>
        <Text style={styles.cardText} numberOfLines={3}>
          <Text style={styles.actorName}>{item.actor?.username ?? 'Someone'}</Text>
          {' '}
          <Text>{item.body}</Text>
        </Text>
        <Text style={styles.timestamp}>{formatRelative(item.created_at)}</Text>
      </View>

      {/* Right: post thumb or accept button */}
      {item.type === 'follow' && item.actor_id && (
        <TouchableOpacity
          style={styles.acceptBtn}
          onPress={() => onFollowAction(item.actor_id!, relationship?.isFollowing ?? false)}
          activeOpacity={0.8}
          disabled={relationship?.isFriend}
        >
          <Text style={styles.acceptBtnText}>{getSocialActionLabel(relationship ?? { isFollowing: false, isFollowedBy: true, isFriend: false })}</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  )
}

export default function NotificationsScreen() {
  const { session } = useAuthStore()
  const queryClient = useQueryClient()

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications', session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*, actor:profiles!actor_id(*)')
        .eq('user_id', session!.user.id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data ?? []
    },
    enabled: !!session,
    refetchInterval: 30_000,
  })

  const markRead = useMutation({
    mutationFn: async () => {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', session!.user.id)
        .eq('is_read', false)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', session?.user.id] }),
  })

  const { data: relationships = {} } = useQuery<Record<string, SocialRelationship>>({
    queryKey: ['notifications-social', session?.user.id, notifications.map((notification) => notification.actor_id).join(',')],
    queryFn: async () => {
      const actorIds = Array.from(new Set(notifications.map((notification) => notification.actor_id).filter(Boolean))) as string[]
      if (!session || actorIds.length === 0) return {}

      const [{ data: followingRows }, { data: followedByRows }] = await Promise.all([
        supabase
          .from('friendships')
          .select('following_id')
          .eq('follower_id', session.user.id)
          .in('following_id', actorIds),
        supabase
          .from('friendships')
          .select('follower_id')
          .eq('following_id', session.user.id)
          .in('follower_id', actorIds),
      ])

      const followingSet = new Set((followingRows ?? []).map((row) => row.following_id))
      const followedBySet = new Set((followedByRows ?? []).map((row) => row.follower_id))
      return actorIds.reduce<Record<string, SocialRelationship>>((acc, actorId) => {
        const isFollowing = followingSet.has(actorId)
        const isFollowedBy = followedBySet.has(actorId)
        acc[actorId] = {
          isFollowing,
          isFollowedBy,
          isFriend: isFollowing && isFollowedBy,
        }
        return acc
      }, {})
    },
    enabled: !!session && notifications.length > 0,
  })

  const followMutation = useMutation({
    mutationFn: async ({ actorId, isFollowing }: { actorId: string; isFollowing: boolean }) => {
      await toggleFollow(session!.user.id, actorId, isFollowing)
    },
    onSuccess: (_, variables) => {
      if (!session) return
      invalidateSocialState(queryClient, session.user.id, variables.actorId)
      queryClient.invalidateQueries({ queryKey: ['notifications-social', session.user.id] })
    },
    onError: showSocialError,
  })

  const newNotifs = notifications.filter(n => !n.is_read)
  const earlierNotifs = notifications.filter(n => n.is_read)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <BrandWordmark color={Colors.textPrimary} />
          <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/people-search' as never)}>
            <Ionicons name="search" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <View style={styles.titleRow}>
          <Text style={styles.title}>ACTIVITY</Text>
          <View style={styles.titleUnderline} />
        </View>
      </View>

      <FlatList
        data={[]}
        keyExtractor={() => 'static'}
        renderItem={null}
        ListHeaderComponent={
          <>
            {/* NEW section */}
            {newNotifs.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionLabel}>NEW</Text>
                  <View style={styles.newDot} />
                </View>
                {newNotifs.map(n => (
                  <NotifCard
                    key={n.id}
                    item={n}
                    relationship={n.actor_id ? relationships[n.actor_id] : undefined}
                    onFollowAction={(actorId, isFollowing) => followMutation.mutate({ actorId, isFollowing })}
                  />
                ))}
              </View>
            )}
            {/* EARLIER section */}
            {earlierNotifs.length > 0 && (
              <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>EARLIER</Text>
              </View>
              {earlierNotifs.map(n => (
                  <NotifCard
                    key={n.id}
                    item={n}
                    relationship={n.actor_id ? relationships[n.actor_id] : undefined}
                    onFollowAction={(actorId, isFollowing) => followMutation.mutate({ actorId, isFollowing })}
                  />
                ))}
              </View>
            )}
            {notifications.length === 0 && !isLoading && (
              <Text style={styles.emptyText}>No activity yet.</Text>
            )}
          </>
        }
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => { if (newNotifs.length > 0) markRead.mutate() }}
        contentContainerStyle={{ paddingBottom: Space.xl }}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: { paddingHorizontal: Space.lg, paddingBottom: Space.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Space.sm },
  titleRow: { marginTop: Space.xs },
  title: { fontSize: Type['3xl'], fontWeight: '900', color: Colors.textPrimary, letterSpacing: 1 },
  titleUnderline: { width: 48, height: 3, backgroundColor: Colors.accent, marginTop: Space.xs },

  // Sections
  section: { paddingHorizontal: Space.lg, paddingTop: Space.lg },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, marginBottom: Space.sm },
  sectionLabel: { fontSize: Type.xs, fontWeight: '700', color: Colors.textMuted, letterSpacing: 2 },
  newDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accent },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    marginBottom: Space.sm,
    overflow: 'hidden',
    padding: Space.md,
    gap: Space.sm,
  },
  unreadBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: Colors.accent },
  cardLeft: { paddingLeft: Space.xs },
  avatarWrap: { position: 'relative' },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: {
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOverlay: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 2 },
  cardText: { fontSize: Type.sm, color: Colors.textSecondary, lineHeight: 18 },
  actorName: { fontWeight: '700', color: Colors.textPrimary },
  timestamp: { fontSize: Type.xs, color: Colors.textMuted, fontWeight: '600', letterSpacing: 0.5 },

  // Accept button
  acceptBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radii.full,
    paddingHorizontal: Space.md,
    paddingVertical: Space.xs,
  },
  acceptBtnText: { color: Colors.textPrimary, fontSize: Type.xs, fontWeight: '800', letterSpacing: 1 },

  emptyText: { color: Colors.textMuted, textAlign: 'center', marginTop: Space.xl, fontSize: Type.sm },
})
