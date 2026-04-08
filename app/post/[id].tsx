import { useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Image, KeyboardAvoidingView, Platform, StatusBar, Dimensions,
  Animated, Pressable, Easing, PanResponder,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../src/lib/supabase'
import { openProfile } from '../../src/features/profile-navigation'
import { useAuthStore } from '../../src/stores/authStore'
import { Colors, Space, Radii, Type } from '../../src/tokens'
import { getDualSnapAssets, getPostMediaUrl } from '../../src/features/post-media'
import type { Post, PostComment } from '../../src/types'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const SWIPE_CLOSE_DISTANCE = SCREEN_WIDTH * 0.3
const SWIPE_CLOSE_VELOCITY = 0.9

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { session } = useAuthStore()
  const queryClient = useQueryClient()
  const insets = useSafeAreaInsets()
  const [body, setBody] = useState('')
  const [isInsetExpanded, setIsInsetExpanded] = useState(false)
  const [likePending, setLikePending] = useState(false)
  const [heartBurst, setHeartBurst] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  })
  const postQueryKey = ['post', id, session?.user.id] as const
  const lastTapRef = useRef(0)
  const singleTapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartScale = useRef(new Animated.Value(0.4)).current
  const heartOpacity = useRef(new Animated.Value(0)).current
  const screenTranslateX = useRef(new Animated.Value(0)).current

  const { data: post } = useQuery<Post | null>({
    queryKey: postQueryKey,
    queryFn: async () => {
      const { data } = await supabase
        .from('posts')
        .select('*, profile:profiles(*), gym:gyms(*), post_media(*)')
        .eq('id', id)
        .single()
      if (data && session) {
        const { data: likeRow } = await supabase
          .from('post_likes')
          .select('post_id')
          .eq('post_id', id)
          .eq('user_id', session.user.id)
          .maybeSingle()
        return { ...data, user_has_liked: !!likeRow }
      }
      return data ?? null
    },
    enabled: !!id,
    refetchInterval: 20_000,
  })

  const { data: comments = [] } = useQuery<PostComment[]>({
    queryKey: ['comments', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('post_comments')
        .select('*, profile:profiles(*)')
        .eq('post_id', id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
      return data ?? []
    },
    enabled: !!id,
    refetchInterval: 20_000,
  })

  const addComment = useMutation({
    mutationFn: async (text: string) => {
      await supabase.from('post_comments').insert({
        post_id: id,
        user_id: session!.user.id,
        body: text,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', id] })
      queryClient.invalidateQueries({ queryKey: ['post', id] })
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      setBody('')
    },
  })

  function handleSend() {
    if (!body.trim() || !session) return
    addComment.mutate(body.trim())
  }

  useEffect(() => {
    return () => {
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current)
      }
    }
  }, [])

  function showHeartBurst(x: number, y: number) {
    setHeartBurst({ x, y, visible: true })
    heartScale.setValue(0.4)
    heartOpacity.setValue(0)

    Animated.sequence([
      Animated.parallel([
        Animated.spring(heartScale, {
          toValue: 1.15,
          friction: 6,
          tension: 140,
          useNativeDriver: true,
        }),
        Animated.timing(heartOpacity, {
          toValue: 1,
          duration: 120,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(260),
      Animated.parallel([
        Animated.timing(heartScale, {
          toValue: 0.9,
          duration: 180,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(heartOpacity, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start(({ finished }) => {
      if (finished) {
        setHeartBurst((current) => ({ ...current, visible: false }))
      }
    })
  }

  async function handleLike(forceLike = false) {
    if (!session || !post || likePending) return

    const liked = post.user_has_liked ?? false
    if (forceLike && liked) return

    setLikePending(true)

    const next = !liked
    const prevCount = post.like_count

    queryClient.setQueryData<Post | null>(postQueryKey, (old) =>
      old ? { ...old, user_has_liked: next, like_count: next ? old.like_count + 1 : Math.max(old.like_count - 1, 0) } : old
    )
    queryClient.setQueriesData<Post[]>({ queryKey: ['feed'] }, (old) =>
      old?.map(p => p.id === post.id
        ? { ...p, user_has_liked: next, like_count: next ? p.like_count + 1 : Math.max(p.like_count - 1, 0) }
        : p
      )
    )

    const { error } = next
      ? await supabase.from('post_likes').insert({ post_id: id, user_id: session.user.id })
      : await supabase.from('post_likes').delete().eq('post_id', id).eq('user_id', session.user.id)

    if (error) {
      queryClient.setQueryData<Post | null>(postQueryKey, (old) =>
        old ? { ...old, user_has_liked: liked, like_count: prevCount } : old
      )
      queryClient.setQueriesData<Post[]>({ queryKey: ['feed'] }, (old) =>
        old?.map(p => p.id === post.id
          ? { ...p, user_has_liked: liked, like_count: prevCount }
          : p
        )
      )
    }

    queryClient.invalidateQueries({ queryKey: ['post', id] })
    queryClient.invalidateQueries({ queryKey: ['feed'] })
    setLikePending(false)
  }

  function handleMediaPress(event: Parameters<NonNullable<React.ComponentProps<typeof Pressable>['onPress']>>[0]) {
    const now = Date.now()
    const isDoubleTap = now - lastTapRef.current < 250
    const { locationX, locationY } = event.nativeEvent

    if (isDoubleTap) {
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current)
        singleTapTimeoutRef.current = null
      }
      showHeartBurst(locationX, locationY)
      void handleLike(true)
    } else {
      singleTapTimeoutRef.current = setTimeout(() => {
        singleTapTimeoutRef.current = null
      }, 250)
    }

    lastTapRef.current = now
  }

  const swipeBackHandlers = useMemo(() => {
    if (Platform.OS === 'web') return {}

    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => (
        gestureState.dx > 12
        && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.25
      ),
      onPanResponderMove: (_, gestureState) => {
        screenTranslateX.setValue(Math.max(gestureState.dx, 0))
      },
      onPanResponderRelease: (_, gestureState) => {
        const shouldClose = gestureState.dx >= SWIPE_CLOSE_DISTANCE || gestureState.vx >= SWIPE_CLOSE_VELOCITY

        if (shouldClose) {
          Animated.timing(screenTranslateX, {
            toValue: SCREEN_WIDTH,
            duration: 180,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start(({ finished }) => {
            if (finished) {
              router.back()
            }
          })
          return
        }

        Animated.spring(screenTranslateX, {
          toValue: 0,
          damping: 22,
          mass: 0.9,
          stiffness: 220,
          useNativeDriver: true,
        }).start()
      },
      onPanResponderTerminate: () => {
        Animated.spring(screenTranslateX, {
          toValue: 0,
          damping: 22,
          mass: 0.9,
          stiffness: 220,
          useNativeDriver: true,
        }).start()
      },
    }).panHandlers
  }, [screenTranslateX])

  if (!post) return (
    <View style={styles.loadingWrap}>
      <Text style={styles.loadingText}>Loading...</Text>
    </View>
  )

  const avatarUrl = post.profile?.avatar_url
    ? supabase.storage.from('avatars').getPublicUrl(post.profile.avatar_url).data.publicUrl
    : null

  const { ordered } = getDualSnapAssets(post.post_media)
  const primaryMedia = isInsetExpanded ? ordered[1] ?? ordered[0] ?? null : ordered[0] ?? null
  const secondaryMedia = isInsetExpanded ? ordered[0] ?? null : ordered[1] ?? null
  const mediaUrl = getPostMediaUrl(primaryMedia?.storage_path)
  const insetUrl = getPostMediaUrl(secondaryMedia?.storage_path)
  const screenOverlayOpacity = screenTranslateX.interpolate({
    inputRange: [0, SCREEN_WIDTH],
    outputRange: [1, 0.7],
    extrapolate: 'clamp',
  })
  const cardScale = screenTranslateX.interpolate({
    inputRange: [0, SCREEN_WIDTH],
    outputRange: [1, 0.96],
    extrapolate: 'clamp',
  })
  const cardBorderRadius = screenTranslateX.interpolate({
    inputRange: [0, SCREEN_WIDTH * 0.5],
    outputRange: [0, 24],
    extrapolate: 'clamp',
  })

  return (
    <View style={styles.overlay}>
      <Animated.View pointerEvents="none" style={[styles.backdrop, { opacity: screenOverlayOpacity }]} />
      <Animated.View
        style={[
          styles.screenWrap,
          {
            borderRadius: cardBorderRadius,
            transform: [{ translateX: screenTranslateX }, { scale: cardScale }],
          },
        ]}
        {...swipeBackHandlers}
      >
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>POST</Text>
        <View style={{ width: 22 }} />
      </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.bottom}>
          <ScrollView showsVerticalScrollIndicator={false}>

          {/* Author row */}
          <View style={styles.authorRow}>
            <TouchableOpacity style={styles.authorTap} activeOpacity={0.8} onPress={() => openProfile(post.user_id, session?.user.id)}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Ionicons name="person" size={14} color={Colors.textMuted} />
                </View>
              )}
              <View style={styles.authorInfo}>
                <Text style={styles.username}>{post.profile?.username ?? 'unknown'}</Text>
                {post.gym && (
                  <View style={styles.gymRow}>
                    <Ionicons name="location" size={10} color={Colors.accent} />
                    <Text style={styles.gymName}>{post.gym.name.toUpperCase()}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>

          {/* Media */}
          {mediaUrl && (
            <Pressable onPress={handleMediaPress} style={styles.mediaWrap}>
              <Image source={{ uri: mediaUrl }} style={styles.media} resizeMode="cover" />
              {insetUrl && (
                <TouchableOpacity
                  style={styles.insetWrap}
                  activeOpacity={0.9}
                  onPress={() => setIsInsetExpanded((current) => !current)}
                >
                  <Image source={{ uri: insetUrl }} style={styles.insetMedia} resizeMode="cover" />
                  <View style={styles.secondaryHint}>
                    <Ionicons name="expand-outline" size={14} color={Colors.textPrimary} />
                  </View>
                </TouchableOpacity>
              )}
              {heartBurst.visible && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.likeBurst,
                    {
                      left: heartBurst.x - 34,
                      top: heartBurst.y - 34,
                      opacity: heartOpacity,
                      transform: [{ scale: heartScale }],
                    },
                  ]}
                >
                  <Ionicons name="heart" size={68} color={Colors.textPrimary} />
                </Animated.View>
              )}
            </Pressable>
          )}

          {/* Caption */}
          {post.caption ? (
            <Text style={styles.caption}>{post.caption}</Text>
          ) : null}

          {/* Stats */}
          <View style={styles.actionsRow}>
            <TouchableOpacity onPress={() => void handleLike()} style={styles.actionItem} activeOpacity={0.7} disabled={likePending}>
              <Ionicons name={(post.user_has_liked ?? false) ? 'heart' : 'heart-outline'} size={22} color={(post.user_has_liked ?? false) ? Colors.accent : Colors.textSecondary} />
              <Text style={styles.actionCount}>{post.like_count}</Text>
            </TouchableOpacity>
            <View style={styles.actionItem}>
              <Ionicons name="chatbubble-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.actionCount}>{post.comment_count}</Text>
            </View>
          </View>

          {/* Comments */}
          <View style={styles.commentsSection}>
            <Text style={styles.commentsTitle}>COMMENTS</Text>
            {comments.map(c => {
              const cAvatarUrl = c.profile?.avatar_url
                ? supabase.storage.from('avatars').getPublicUrl(c.profile.avatar_url).data.publicUrl
                : null
              return (
                <View key={c.id} style={styles.commentRow}>
                  <TouchableOpacity style={styles.commentTap} activeOpacity={0.8} onPress={() => openProfile(c.user_id, session?.user.id)}>
                    {cAvatarUrl ? (
                      <Image source={{ uri: cAvatarUrl }} style={styles.commentAvatar} />
                    ) : (
                      <View style={[styles.commentAvatar, styles.avatarFallback]}>
                        <Ionicons name="person" size={10} color={Colors.textMuted} />
                      </View>
                    )}
                    <View style={styles.commentBody}>
                      <Text style={styles.commentUsername}>{c.profile?.username ?? 'unknown'}</Text>
                      <Text style={styles.commentText}>{c.body}</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )
            })}
            {comments.length === 0 && (
              <Text style={styles.noComments}>Be the first to comment.</Text>
            )}
          </View>
          <View style={{ height: 80 }} />
          </ScrollView>

          {/* Comment input */}
          <View style={[styles.inputWrap, { paddingBottom: insets.bottom + Space.sm }]}>
            <TextInput
              style={styles.commentInput}
              value={body}
              onChangeText={setBody}
              placeholder="Add a comment..."
              placeholderTextColor={Colors.textMuted}
              returnKeyType="send"
              onSubmitEditing={handleSend}
            />
            <TouchableOpacity onPress={handleSend} activeOpacity={0.7} disabled={!body.trim()}>
              <Ionicons name="send" size={20} color={body.trim() ? Colors.accent : Colors.textMuted} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,8,12,0.6)',
  },
  screenWrap: {
    flex: 1,
    backgroundColor: Colors.background,
    overflow: 'hidden',
    marginVertical: Space.sm,
    marginHorizontal: Space.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 18,
  },
  safe: { flex: 1, backgroundColor: Colors.background },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  loadingText: { color: Colors.textMuted, fontSize: Type.sm },

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

  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm,
    gap: Space.sm,
  },
  authorTap: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, flex: 1 },
  avatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: Colors.accent },
  avatarFallback: { backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  authorInfo: { flex: 1 },
  username: { fontSize: Type.md, fontWeight: '700', color: Colors.textPrimary },
  gymRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  gymName: { fontSize: Type.xs, color: Colors.accent, fontWeight: '600', letterSpacing: 0.5 },

  mediaWrap: { position: 'relative' },
  media: { width: SCREEN_WIDTH, height: SCREEN_WIDTH },
  likeBurst: {
    position: 'absolute',
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insetWrap: {
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
  insetMedia: { width: '100%', height: '100%' },
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
  caption: { paddingHorizontal: Space.lg, paddingTop: Space.sm, color: Colors.textSecondary, fontSize: Type.sm, lineHeight: 20 },

  actionsRow: { flexDirection: 'row', gap: Space.lg, paddingHorizontal: Space.lg, paddingVertical: Space.sm },
  actionItem: { flexDirection: 'row', alignItems: 'center', gap: Space.xs },
  actionCount: { color: Colors.textSecondary, fontSize: Type.sm, fontWeight: '600' },

  commentsSection: { paddingHorizontal: Space.lg, paddingTop: Space.md },
  commentsTitle: { fontSize: Type.xs, fontWeight: '700', color: Colors.textMuted, letterSpacing: 2, marginBottom: Space.sm },
  commentRow: { flexDirection: 'row', gap: Space.sm, marginBottom: Space.sm },
  commentTap: { flexDirection: 'row', gap: Space.sm, flex: 1 },
  commentAvatar: { width: 28, height: 28, borderRadius: 14 },
  commentBody: { flex: 1 },
  commentUsername: { fontSize: Type.xs, fontWeight: '700', color: Colors.textPrimary },
  commentText: { fontSize: Type.sm, color: Colors.textSecondary, lineHeight: 18 },
  noComments: { color: Colors.textMuted, fontSize: Type.sm },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.lg,
    paddingTop: Space.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Space.sm,
    backgroundColor: Colors.background,
  },
  commentInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radii.full,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    color: Colors.textPrimary,
    fontSize: Type.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
})
