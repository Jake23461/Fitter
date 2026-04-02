import { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, StatusBar, Dimensions, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../src/lib/supabase'
import { useAuthStore } from '../../src/stores/authStore'
import { Colors, Space, Radii, Type } from '../../src/tokens'
import { getDualSnapAssets, getPostMediaUrl } from '../../src/features/post-media'
import type { Profile, Post } from '../../src/types'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const GRID_ITEM = (SCREEN_WIDTH - Space.lg * 2 - Space.sm * 2) / 3

export default function OtherProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { session } = useAuthStore()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'posts' | 'prs'>('posts')

  const { data: profile } = useQuery<Profile | null>({
    queryKey: ['profile', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single()
      return data ?? null
    },
    enabled: !!id,
  })

  const { data: isFollowing = false } = useQuery<boolean>({
    queryKey: ['following', session?.user.id, id],
    queryFn: async () => {
      const { data } = await supabase
        .from('friendships')
        .select('id')
        .eq('follower_id', session!.user.id)
        .eq('following_id', id)
        .maybeSingle()
      return !!data
    },
    enabled: !!session && !!id && session.user.id !== id,
  })

  const { data: followerCount = 0 } = useQuery<number>({
    queryKey: ['followers-count', id],
    queryFn: async () => {
      const { count } = await supabase
        .from('friendships')
        .select('id', { count: 'exact', head: true })
        .eq('following_id', id)
      return count ?? 0
    },
    enabled: !!id,
  })

  const { data: posts = [] } = useQuery<Post[]>({
    queryKey: ['user-posts', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('posts')
        .select('*, post_media(*)')
        .eq('user_id', id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(30)
      return data ?? []
    },
    enabled: !!id,
  })

  const toggleFollow = useMutation({
    mutationFn: async () => {
      if (!session) return
      if (isFollowing) {
        await supabase.from('friendships')
          .delete()
          .eq('follower_id', session.user.id)
          .eq('following_id', id)
      } else {
        await supabase.from('friendships').insert({
          follower_id: session.user.id,
          following_id: id,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['following', session?.user.id, id] })
      queryClient.invalidateQueries({ queryKey: ['followers-count', id] })
    },
  })

  const avatarUrl = profile?.avatar_url
    ? supabase.storage.from('avatars').getPublicUrl(profile.avatar_url).data.publicUrl
    : null

  const isSelf = session?.user.id === id

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{profile?.username?.toUpperCase() ?? '...'}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Space.xl }}>

        {/* Avatar + stats */}
        <View style={styles.profileTop}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Ionicons name="person" size={36} color={Colors.textMuted} />
            </View>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{posts.length}</Text>
              <Text style={styles.statLabel}>POSTS</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{followerCount}</Text>
              <Text style={styles.statLabel}>FOLLOWERS</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{profile?.streak_current ?? 0}</Text>
              <Text style={styles.statLabel}>STREAK</Text>
            </View>
          </View>
        </View>

        {/* Name + bio */}
        <View style={styles.bioSection}>
          <Text style={styles.displayName}>{profile?.display_name ?? profile?.username ?? ''}</Text>
          {profile?.bio ? <Text style={styles.bioText}>{profile.bio}</Text> : null}
        </View>

        {/* Follow button (hidden on own profile) */}
        {!isSelf && (
          <View style={styles.followRow}>
            <TouchableOpacity
              style={[styles.followBtn, isFollowing && styles.followingBtn]}
              activeOpacity={0.85}
              onPress={() => toggleFollow.mutate()}
              disabled={toggleFollow.isPending}
            >
              <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
                {isFollowing ? 'FOLLOWING' : 'FOLLOW'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={styles.tab}
            activeOpacity={0.7}
            onPress={() => setActiveTab('posts')}
          >
            <Ionicons
              name="grid-outline"
              size={20}
              color={activeTab === 'posts' ? Colors.accent : Colors.textMuted}
            />
            {activeTab === 'posts' && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tab}
            activeOpacity={0.7}
            onPress={() => setActiveTab('prs')}
          >
            <Ionicons
              name="trophy-outline"
              size={20}
              color={activeTab === 'prs' ? Colors.accent : Colors.textMuted}
            />
            {activeTab === 'prs' && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        </View>

        {/* Posts grid */}
        {activeTab === 'posts' && (
          <View style={styles.postsGrid}>
            {posts.map(post => {
              const thumb = getPostMediaUrl(getDualSnapAssets(post.post_media).primary?.storage_path)
              return (
                <TouchableOpacity
                  key={post.id}
                  style={styles.gridItem}
                  activeOpacity={0.85}
                  onPress={() => router.push(`/post/${post.id}` as never)}
                >
                  {thumb ? (
                    <Image source={{ uri: thumb }} style={styles.gridThumb} />
                  ) : (
                    <View style={[styles.gridThumb, styles.gridThumbFallback]}>
                      <Ionicons name="image-outline" size={20} color={Colors.textMuted} />
                    </View>
                  )}
                </TouchableOpacity>
              )
            })}
            {posts.length === 0 && (
              <Text style={styles.emptyText}>No posts yet.</Text>
            )}
          </View>
        )}

        {/* PRs list */}
        {activeTab === 'prs' && (
          <View style={styles.prList}>
            <Text style={styles.emptyText}>PRs are private.</Text>
          </View>
        )}
      </ScrollView>
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
  headerTitle: { fontSize: Type.md, fontWeight: '800', color: Colors.textPrimary, letterSpacing: 2 },

  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.lg,
    paddingTop: Space.lg,
    gap: Space.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  avatarFallback: { backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  statCell: { alignItems: 'center', gap: 2 },
  statValue: { fontSize: Type.xl, fontWeight: '900', color: Colors.textPrimary },
  statLabel: { fontSize: Type.xs - 1, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1 },

  bioSection: { paddingHorizontal: Space.lg, paddingTop: Space.sm, gap: 4 },
  displayName: { fontSize: Type.md, fontWeight: '700', color: Colors.textPrimary },
  bioText: { fontSize: Type.sm, color: Colors.textSecondary },

  followRow: { paddingHorizontal: Space.lg, paddingTop: Space.md },
  followBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radii.md,
    paddingVertical: Space.sm,
    alignItems: 'center',
  },
  followingBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.border },
  followBtnText: { color: Colors.textPrimary, fontWeight: '800', letterSpacing: 1.5, fontSize: Type.sm },
  followingBtnText: { color: Colors.textSecondary },

  tabRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: Space.md,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: Space.md, position: 'relative' },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: '25%',
    right: '25%',
    height: 2,
    backgroundColor: Colors.accent,
  },

  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Space.lg,
    gap: Space.sm,
    paddingTop: Space.sm,
  },
  gridItem: { width: GRID_ITEM, aspectRatio: 1 },
  gridThumb: { width: '100%', height: '100%', borderRadius: Radii.sm },
  gridThumbFallback: { backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },

  prList: { padding: Space.lg },
  emptyText: {
    color: Colors.textMuted,
    fontSize: Type.sm,
    textAlign: 'center',
    padding: Space.xl,
    flex: 1,
  },
})
