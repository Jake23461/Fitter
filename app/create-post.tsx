import { useMemo, useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Image, ScrollView, Alert, StatusBar, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../src/lib/supabase'
import { useAuthStore } from '../src/stores/authStore'
import { useSessionStore } from '../src/stores/sessionStore'
import { Colors, Space, Radii, Type } from '../src/tokens'

function getMimeType(uri: string) {
  const uriPath = uri.split('?')[0]
  const uriExt = uriPath.includes('.') && !uri.startsWith('blob:')
    ? uriPath.split('.').pop()?.toLowerCase()
    : undefined
  const extMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  }
  return (uriExt && extMap[uriExt]) ?? 'image/jpeg'
}

export default function CreatePostScreen() {
  const { session } = useAuthStore()
  const { activeSession } = useSessionStore()
  const queryClient = useQueryClient()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ backUri?: string; frontUri?: string; uri?: string }>()

  const [caption, setCaption] = useState('')

  const backUri = typeof params.backUri === 'string' ? params.backUri : undefined
  const frontUri = typeof params.frontUri === 'string' ? params.frontUri : undefined
  const fallbackUri = typeof params.uri === 'string' ? params.uri : undefined

  const mediaUris = useMemo(
    () => [backUri, frontUri].filter((uri): uri is string => !!uri),
    [backUri, frontUri],
  )
  const primaryUri = backUri ?? fallbackUri ?? null
  const secondaryUri = frontUri ?? null

  const publish = useMutation({
    mutationFn: async () => {
      if (!session) return
      if (!activeSession) {
        Alert.alert('Check in first', 'You need to be checked in at a gym to post.')
        return
      }
      if (!primaryUri) {
        Alert.alert('Missing snap', 'Please retake your check-in snap.')
        return
      }

      const uploadedMedia: Array<{ storage_path: string; media_type: 'photo' }> = []

      for (const [index, mediaUri] of mediaUris.entries()) {
        const response = await fetch(mediaUri)
        const arrayBuffer = await response.arrayBuffer()
        const mimeType = getMimeType(mediaUri)
        const ext = mimeType.split('/')[1].replace('jpeg', 'jpg')
        const suffix = index === 0 ? 'back' : 'front'
        const fileName = `${session.user.id}/${Date.now()}-${suffix}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('post-media')
          .upload(fileName, arrayBuffer, { contentType: mimeType, upsert: false })
        if (uploadError) {
          Alert.alert('Upload failed', uploadError.message)
          return
        }

        uploadedMedia.push({ storage_path: fileName, media_type: 'photo' })
      }

      const { data: post, error: postError } = await supabase
        .from('posts')
        .insert({
          user_id: session.user.id,
          session_id: activeSession.id,
          gym_id: activeSession.gym_id,
          caption: caption.trim() || null,
          post_date: new Date().toISOString().split('T')[0],
        })
        .select()
        .single()

      if (postError || !post) {
        const msg = postError?.code === '23505'
          ? 'You\'ve already posted today. Come back tomorrow!'
          : (postError?.message ?? 'Post failed')
        Alert.alert('Error', msg)
        return
      }

      const { error: mediaError } = await supabase.from('post_media').insert(
        uploadedMedia.map((media) => ({
          post_id: post.id,
          media_type: media.media_type,
          storage_path: media.storage_path,
          width: null,
          height: null,
          duration_seconds: null,
        })),
      )

      if (mediaError) {
        Alert.alert('Error', mediaError.message)
        return
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['feed'] }),
        queryClient.invalidateQueries({ queryKey: ['feed-unlock'] }),
        queryClient.invalidateQueries({ queryKey: ['todays-post'] }),
        queryClient.invalidateQueries({ queryKey: ['user-posts'] }),
        queryClient.invalidateQueries({ queryKey: ['posts-month'] }),
      ])

      router.replace('/(tabs)/feed')
    },
  })

  function handleRetake() {
    router.replace('/(tabs)/checkin')
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={handleRetake} activeOpacity={0.7}>
          <Text style={styles.cancelBtn}>RETAKE</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>REVIEW SNAP</Text>
        <TouchableOpacity
          onPress={() => publish.mutate()}
          activeOpacity={0.8}
          disabled={!primaryUri || publish.isPending}
          style={[styles.shareBtn, (!primaryUri || publish.isPending) && styles.shareBtnDisabled]}
        >
          <Text style={styles.shareBtnText}>{publish.isPending ? 'POSTING...' : 'POST'}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.bottom}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.previewCard}>
            {primaryUri ? (
              <Image source={{ uri: primaryUri }} style={styles.primaryPreview} resizeMode="cover" />
            ) : (
              <View style={styles.mediaPlaceholder}>
                <Ionicons name="camera" size={40} color={Colors.textMuted} />
                <Text style={styles.mediaPlaceholderText}>NO SNAP AVAILABLE</Text>
              </View>
            )}

            {secondaryUri && (
              <View style={styles.secondaryWrap}>
                <Image source={{ uri: secondaryUri }} style={styles.secondaryPreview} resizeMode="cover" />
              </View>
            )}
          </View>

          <View style={styles.reviewMetaRow}>
            <Text style={styles.reviewKicker}>YOUR CHECK-IN SNAP</Text>
            {activeSession?.gym && (
              <View style={styles.sessionInfo}>
                <Ionicons name="location" size={14} color={Colors.accent} />
                <Text style={styles.sessionInfoText}>{activeSession.gym.name}</Text>
              </View>
            )}
          </View>

          <TextInput
            style={styles.captionInput}
            value={caption}
            onChangeText={setCaption}
            placeholder="Add a caption if you want..."
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={300}
          />
          <Text style={styles.charCount}>{caption.length}/300</Text>

          {!activeSession && (
            <View style={styles.noSessionWarn}>
              <Ionicons name="warning-outline" size={16} color={Colors.textMuted} />
              <Text style={styles.noSessionText}>You need to check in to post.</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  cancelBtn: { color: Colors.textSecondary, fontSize: Type.sm, fontWeight: '700' },
  headerTitle: { fontSize: Type.md, fontWeight: '900', color: Colors.textPrimary, letterSpacing: 2 },
  shareBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radii.full,
    paddingVertical: Space.xs,
    paddingHorizontal: Space.md,
  },
  shareBtnDisabled: { opacity: 0.4 },
  shareBtnText: { color: Colors.textPrimary, fontSize: Type.sm, fontWeight: '800', letterSpacing: 1 },

  scroll: { padding: Space.lg, paddingBottom: Space.xl, gap: Space.lg },
  previewCard: {
    position: 'relative',
    borderRadius: Radii.xl,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  primaryPreview: { width: '100%', aspectRatio: 3 / 4 },
  secondaryWrap: {
    position: 'absolute',
    right: Space.md,
    bottom: Space.md,
    width: '28%',
    aspectRatio: 3 / 4,
    borderRadius: Radii.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.textPrimary,
    backgroundColor: Colors.surfaceElevated,
  },
  secondaryPreview: { width: '100%', height: '100%' },
  mediaPlaceholder: {
    aspectRatio: 3 / 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
  },
  mediaPlaceholderText: { color: Colors.textMuted, fontSize: Type.sm, fontWeight: '700', letterSpacing: 1.5 },

  reviewMetaRow: { gap: Space.sm },
  reviewKicker: { color: Colors.textMuted, fontSize: Type.xs, fontWeight: '800', letterSpacing: 2 },
  captionInput: {
    color: Colors.textPrimary,
    fontSize: Type.md,
    lineHeight: 22,
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Space.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  charCount: { color: Colors.textMuted, fontSize: Type.xs, alignSelf: 'flex-end' },
  sessionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
  },
  sessionInfoText: { color: Colors.accent, fontSize: Type.sm, fontWeight: '600' },
  noSessionWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    padding: Space.md,
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  noSessionText: { color: Colors.textMuted, fontSize: Type.sm },
})
