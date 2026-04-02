import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Image, KeyboardAvoidingView, Platform, StatusBar, Dimensions,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../src/lib/supabase'
import { useAuthStore } from '../../src/stores/authStore'
import { Colors, Space, Radii, Type } from '../../src/tokens'
import { getDualSnapAssets, getPostMediaUrl } from '../../src/features/post-media'
import type { Post, PostComment } from '../../src/types'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { session } = useAuthStore()
  const queryClient = useQueryClient()
  const insets = useSafeAreaInsets()
  const [body, setBody] = useState('')
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)

  const { data: post } = useQuery<Post | null>({
    queryKey: ['post', id],
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
      setBody('')
    },
  })

  function handleSend() {
    if (!body.trim() || !session) return
    addComment.mutate(body.trim())
  }

  // Sync like state when post data loads
  useEffect(() => {
    if (post) {
      setLiked(post.user_has_liked ?? false)
      setLikeCount(post.like_count)
    }
  }, [post?.id, post?.user_has_liked, post?.like_count])

  async function handleLike() {
    if (!session) return
    const next = !liked
    setLiked(next)
    setLikeCount(c => next ? c + 1 : c - 1)
    if (next) {
      await supabase.from('post_likes').insert({ post_id: id, user_id: session.user.id })
    } else {
      await supabase.from('post_likes').delete().eq('post_id', id).eq('user_id', session.user.id)
    }
  }

  if (!post) return (
    <View style={styles.loadingWrap}>
      <Text style={styles.loadingText}>Loading...</Text>
    </View>
  )

  const avatarUrl = post.profile?.avatar_url
    ? supabase.storage.from('avatars').getPublicUrl(post.profile.avatar_url).data.publicUrl
    : null

  const { primary, secondary } = getDualSnapAssets(post.post_media)
  const mediaUrl = getPostMediaUrl(primary?.storage_path)
  const insetUrl = getPostMediaUrl(secondary?.storage_path)

  return (
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
          </View>

          {/* Media */}
          {mediaUrl && (
            <View style={styles.mediaWrap}>
              <Image source={{ uri: mediaUrl }} style={styles.media} resizeMode="cover" />
              {insetUrl && (
                <View style={styles.insetWrap}>
                  <Image source={{ uri: insetUrl }} style={styles.insetMedia} resizeMode="cover" />
                </View>
              )}
            </View>
          )}

          {/* Caption */}
          {post.caption ? (
            <Text style={styles.caption}>{post.caption}</Text>
          ) : null}

          {/* Stats */}
          <View style={styles.actionsRow}>
            <TouchableOpacity onPress={handleLike} style={styles.actionItem} activeOpacity={0.7}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? Colors.accent : Colors.textSecondary} />
              <Text style={styles.actionCount}>{likeCount}</Text>
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
  )
}

const styles = StyleSheet.create({
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
  avatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: Colors.accent },
  avatarFallback: { backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  authorInfo: { flex: 1 },
  username: { fontSize: Type.md, fontWeight: '700', color: Colors.textPrimary },
  gymRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  gymName: { fontSize: Type.xs, color: Colors.accent, fontWeight: '600', letterSpacing: 0.5 },

  mediaWrap: { position: 'relative' },
  media: { width: SCREEN_WIDTH, height: SCREEN_WIDTH },
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
  caption: { paddingHorizontal: Space.lg, paddingTop: Space.sm, color: Colors.textSecondary, fontSize: Type.sm, lineHeight: 20 },

  actionsRow: { flexDirection: 'row', gap: Space.lg, paddingHorizontal: Space.lg, paddingVertical: Space.sm },
  actionItem: { flexDirection: 'row', alignItems: 'center', gap: Space.xs },
  actionCount: { color: Colors.textSecondary, fontSize: Type.sm, fontWeight: '600' },

  commentsSection: { paddingHorizontal: Space.lg, paddingTop: Space.md },
  commentsTitle: { fontSize: Type.xs, fontWeight: '700', color: Colors.textMuted, letterSpacing: 2, marginBottom: Space.sm },
  commentRow: { flexDirection: 'row', gap: Space.sm, marginBottom: Space.sm },
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
