import { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, StatusBar, Pressable, Image,
  Dimensions, Platform, ScrollView, TextInput, KeyboardAvoidingView, RefreshControl,
} from 'react-native'
import type { ViewStyle } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { CameraView, CameraType, FlashMode, useCameraPermissions } from 'expo-camera'
import * as Location from 'expo-location'
import { router } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../src/lib/supabase'
import { getDualSnapAssets, getPostMediaUrl } from '../../src/features/post-media'
import { useAuthStore } from '../../src/stores/authStore'
import { useSessionStore } from '../../src/stores/sessionStore'
import { Colors, Space, Radii, Type } from '../../src/tokens'
import type { Gym, Post, PostComment } from '../../src/types'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const COUNTDOWN_SECONDS = 120 // 2:00
const PROXIMITY_CHECK_DISABLED =
  __DEV__ || process.env.EXPO_PUBLIC_DISABLE_GYM_PROXIMITY_CHECK === 'true'

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} LEFT`
}

function getOppositeFacing(current: CameraType): CameraType {
  return current === 'back' ? 'front' : 'back'
}

export default function CheckinScreen() {
  const insets = useSafeAreaInsets()
  const { session } = useAuthStore()
  const { activeSession, fetchActiveSession } = useSessionStore()
  const queryClient = useQueryClient()
  const today = new Date().toISOString().split('T')[0]

  const [permission, requestPermission] = useCameraPermissions()
  const [facing, setFacing] = useState<CameraType>('back')
  const [flash, setFlash] = useState<FlashMode>('off')
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  const [nearbyGym, setNearbyGym] = useState<Gym | null>(null)
  const [testGym, setTestGym] = useState<Gym | null>(null)
  const [checkinLoading, setCheckinLoading] = useState(false)
  const [firstCapture, setFirstCapture] = useState<{ uri: string; facing: CameraType } | null>(null)
  const [captureLoading, setCaptureLoading] = useState(false)
  const [selectedSnap, setSelectedSnap] = useState<'primary' | 'secondary'>('primary')
  const [commentBody, setCommentBody] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const cameraRef = useRef<CameraView>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastTapRef = useRef(0)

  const { data: todaysPost, isLoading: todaysPostLoading, refetch: refetchTodaysPost } = useQuery<Post | null>({
    queryKey: ['todays-post', session?.user.id, today],
    queryFn: async () => {
      if (!session) return null
      const { data, error } = await supabase
        .from('posts')
        .select('*, gym:gyms(*), post_media(*)')
        .eq('user_id', session.user.id)
        .eq('is_deleted', false)
        .eq('post_date', today)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      return data
    },
    enabled: !!session,
    staleTime: 60_000,
  })

  const todaysAssets = getDualSnapAssets(todaysPost?.post_media)
  const primaryTodayUri = getPostMediaUrl(todaysAssets.primary?.storage_path)
  const secondaryTodayUri = getPostMediaUrl(todaysAssets.secondary?.storage_path)
  const activeSnapUri = selectedSnap === 'secondary' && secondaryTodayUri
    ? secondaryTodayUri
    : primaryTodayUri
  const insetSnapUri = selectedSnap === 'secondary' ? primaryTodayUri : secondaryTodayUri

  const { data: comments = [] } = useQuery<PostComment[]>({
    queryKey: ['comments', todaysPost?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('post_comments')
        .select('*, profile:profiles(*)')
        .eq('post_id', todaysPost!.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
      return data ?? []
    },
    enabled: !!todaysPost?.id,
  })

  const addComment = useMutation({
    mutationFn: async (body: string) => {
      if (!session || !todaysPost?.id) return
      await supabase.from('post_comments').insert({
        post_id: todaysPost.id,
        user_id: session.user.id,
        body,
      })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['comments', todaysPost?.id] }),
        queryClient.invalidateQueries({ queryKey: ['todays-post'] }),
      ])
      setCommentBody('')
    },
  })

  // Countdown timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown(c => (c > 0 ? c - 1 : 0))
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  // Find nearby gym on mount
  useEffect(() => {
    loadNearbyGym()
  }, [])

  async function loadNearbyGym() {
    try {
      const { data } = await supabase.from('gyms').select('*')
      if (!data) return
      if (PROXIMITY_CHECK_DISABLED) {
        setTestGym(data[0] ?? null)
      }

      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      // Find closest gym within 500m
      const closest = data.find(gym => {
        const dLat = (gym.lat - loc.coords.latitude) * (Math.PI / 180)
        const dLng = (gym.lng - loc.coords.longitude) * (Math.PI / 180)
        const a = Math.sin(dLat / 2) ** 2 +
          Math.cos(gym.lat * Math.PI / 180) * Math.cos(loc.coords.latitude * Math.PI / 180) *
          Math.sin(dLng / 2) ** 2
        const dist = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        return dist <= gym.radius_meters
      })
      if (closest) setNearbyGym(closest)
    } catch (_) {
      // silently continue without location
    }
  }

  async function handleCheckin() {
    const gymToUse = nearbyGym ?? (PROXIMITY_CHECK_DISABLED ? testGym : null)

    if (!session || !gymToUse) {
      Alert.alert('Not at a gym', 'You need to be at a gym location to check in.')
      return
    }
    setCheckinLoading(true)
    try {
      const { error } = await supabase.from('gym_sessions').insert({
        user_id: session.user.id,
        gym_id: gymToUse.id,
        location_verified: !PROXIMITY_CHECK_DISABLED || !!nearbyGym,
        session_date: new Date().toISOString().split('T')[0],
      })
      if (error) { Alert.alert('Error', error.message); return }
      await fetchActiveSession(session.user.id)
    } finally {
      setCheckinLoading(false)
    }
  }

  async function handleCapture() {
    if (!cameraRef.current || captureLoading) return
    if (todaysPost) {
      Alert.alert('Already posted', 'You already uploaded today\'s check-in snap. Come back tomorrow.')
      return
    }
    if (firstCapture && firstCapture.facing === facing) {
      setFacing(getOppositeFacing(firstCapture.facing))
      return
    }

    try {
      setCaptureLoading(true)
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 })
      if (photo?.uri) {
        if (!firstCapture) {
          setFirstCapture({ uri: photo.uri, facing })
          setFacing(getOppositeFacing(facing))
          return
        }

        const captures = [
          firstCapture,
          { uri: photo.uri, facing },
        ]
        const backUri = captures.find((capture) => capture.facing === 'back')?.uri
        const frontUri = captures.find((capture) => capture.facing === 'front')?.uri

        setFirstCapture(null)
        setFacing('back')
        router.push({
          pathname: '/create-post',
          params: { backUri, frontUri },
        } as never)
      }
    } catch (_) {
      Alert.alert('Camera error', 'We couldn\'t capture your snap. Please try again.')
    } finally {
      setCaptureLoading(false)
    }
  }

  async function handleCheckout() {
    Alert.alert('Check Out', 'End your session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Check Out',
        style: 'destructive',
        onPress: async () => {
          await useSessionStore.getState().checkOut()
          router.push('/(tabs)/feed')
        },
      },
    ])
  }

  function handleClose() {
    setFirstCapture(null)
    setFacing('back')
    router.push('/(tabs)/feed')
  }

  function handlePreviewTap() {
    const now = Date.now()
    if (now - lastTapRef.current < 280) {
      setFacing((current) => getOppositeFacing(current))
    }
    lastTapRef.current = now
  }

  function handleSendComment() {
    if (!commentBody.trim() || !session || !todaysPost?.id || addComment.isPending) return
    addComment.mutate(commentBody.trim())
  }

  async function handleRefresh() {
    if (!session) return
    setRefreshing(true)
    await Promise.all([
      refetchTodaysPost(),
      fetchActiveSession(session.user.id),
    ])
    setRefreshing(false)
  }

  if (!permission) return <View style={styles.fill} />

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.fill}>
        <View style={styles.permissionWrap}>
          <Ionicons name="camera" size={48} color={Colors.textMuted} />
          <Text style={styles.permissionTitle}>CAMERA ACCESS NEEDED</Text>
          <Text style={styles.permissionBody}>Dialed needs camera access to capture your session.</Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>GRANT ACCESS</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  if (todaysPostLoading) {
    return <View style={styles.fill} />
  }

  if (todaysPost) {
    return (
      <SafeAreaView style={styles.doneSafe}>
        <StatusBar barStyle="light-content" hidden />

        <View style={[styles.doneTopBar, { paddingTop: insets.top + Space.xs }]}>
          <TouchableOpacity onPress={handleClose} activeOpacity={0.8} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.donePill}>
            <View style={styles.doneDot} />
            <Text style={styles.donePillText}>TODAY COMPLETE</Text>
          </View>

          {activeSession ? (
            <TouchableOpacity
              style={styles.checkoutBtn}
              onPress={handleCheckout}
              activeOpacity={0.8}
            >
              <Text style={styles.checkoutBtnText}>END</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.doneTopSpacer} />
          )}
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={insets.bottom}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.doneContent, { paddingBottom: insets.bottom + 96 }]}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={Colors.accent}
              />
            }
          >
            <Text style={styles.doneBody}>Come back tomorrow!</Text>

            <View style={styles.doneMetaTop}>
              <View style={styles.locationStrip}>
                <Ionicons name="location" size={12} color={Colors.textSecondary} />
                <Text style={styles.locationText} numberOfLines={1}>
                  {todaysPost.gym?.name
                    ? `POSTED @ ${todaysPost.gym.name.toUpperCase()}`
                    : 'POSTED TODAY'}
                </Text>
              </View>
            </View>

            <View style={styles.snapFrame}>
              <View>
                {activeSnapUri ? (
                  <Image source={{ uri: activeSnapUri }} style={styles.donePrimaryImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.donePrimaryImage, styles.doneFallback]}>
                    <Ionicons name="image-outline" size={40} color={Colors.textMuted} />
                    <Text style={styles.doneFallbackText}>SNAP UPLOADED</Text>
                  </View>
                )}
              </View>

              {insetSnapUri && (
                <TouchableOpacity
                  style={styles.doneSecondaryWrap}
                  activeOpacity={0.9}
                  onPress={() => setSelectedSnap((current) => current === 'primary' ? 'secondary' : 'primary')}
                >
                  <Image source={{ uri: insetSnapUri }} style={styles.doneSecondaryImage} resizeMode="cover" />
                  <View style={styles.secondaryHint}>
                    <Ionicons name="expand-outline" size={14} color={Colors.textPrimary} />
                  </View>
                </TouchableOpacity>
              )}
            </View>

            {todaysPost.caption ? (
              <Text style={styles.doneCaption}>{todaysPost.caption}</Text>
            ) : null}

            <View style={styles.commentsSection}>
              <Text style={styles.commentsTitle}>COMMENTS</Text>
              <View style={styles.inlineComposer}>
                <TextInput
                  style={styles.commentInput}
                  value={commentBody}
                  onChangeText={setCommentBody}
                  placeholder="Add a comment..."
                  placeholderTextColor={Colors.textMuted}
                  returnKeyType="send"
                  onSubmitEditing={handleSendComment}
                />
                <TouchableOpacity
                  onPress={handleSendComment}
                  activeOpacity={0.7}
                  disabled={!commentBody.trim() || addComment.isPending}
                >
                  <Ionicons
                    name="send"
                    size={20}
                    color={commentBody.trim() ? Colors.accent : Colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
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
                    <View style={styles.commentBodyWrap}>
                      <Text style={styles.commentUsername}>{c.profile?.username ?? 'unknown'}</Text>
                      <Text style={styles.commentText}>{c.body}</Text>
                    </View>
                  </View>
                )
              })}
              {comments.length === 0 && (
                <Text style={styles.noComments}>No comments yet.</Text>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

      </SafeAreaView>
    )
  }

  return (
    <View style={styles.fill}>
      <StatusBar barStyle="light-content" hidden />

      <Pressable style={StyleSheet.absoluteFill} onPress={handlePreviewTap}>
        {/* Full-screen camera */}
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          flash={flash}
          mirror={facing === 'front'}
        />
      </Pressable>

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + Space.sm }]}>
        <TouchableOpacity onPress={handleClose} activeOpacity={0.8} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>

        {/* Countdown pill */}
        <View style={styles.countdownPill}>
          <View style={styles.countdownDot} />
          <Text style={styles.countdownText}>{formatTime(countdown)}</Text>
        </View>

        {/* Camera controls */}
        <View style={styles.cameraControls}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setFlash(f => f === 'off' ? 'on' : 'off')}
          >
            <Ionicons
              name={flash === 'on' ? 'flash' : 'flash-off'}
              size={22}
              color={Colors.textPrimary}
            />
          </TouchableOpacity>
          {activeSession && (
            <TouchableOpacity
              style={styles.checkoutBtn}
              onPress={handleCheckout}
              activeOpacity={0.8}
            >
              <Text style={styles.checkoutBtnText}>END</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Bottom — location + record button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Space.md }]}>
        {/* Location strip */}
        <View style={styles.locationStrip}>
          <Ionicons name="location" size={12} color={Colors.textSecondary} />
          <Text style={styles.locationText} numberOfLines={1}>
            {activeSession?.gym
              ? `CHECKED-IN @ ${activeSession.gym.name.toUpperCase()}`
              : nearbyGym
                ? nearbyGym.name.toUpperCase()
                : PROXIMITY_CHECK_DISABLED && testGym
                  ? `TEST MODE @ ${testGym.name.toUpperCase()}`
                  : 'NO GYM NEARBY'}
          </Text>
        </View>

        {/* Record / Check-in button */}
        <View style={styles.recordRow}>
          {activeSession ? (
            <TouchableOpacity
              style={[styles.recordBtn, captureLoading && styles.recordBtnDisabled]}
              activeOpacity={0.85}
              onPress={handleCapture}
              disabled={captureLoading}
            >
              <View style={styles.recordInner} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.checkinBtn, checkinLoading && styles.recordBtnDisabled]}
              activeOpacity={0.85}
              onPress={handleCheckin}
              disabled={checkinLoading}
            >
              <Text style={styles.checkinBtnText}>
                {checkinLoading ? 'CHECKING IN...' : 'CHECK IN'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.flipSmall}
            onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}
            activeOpacity={0.8}
          >
            <Ionicons name="camera-reverse" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: Colors.background },
  doneSafe: { flex: 1, backgroundColor: Colors.background },

  // Permission
  permissionWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Space.xl, gap: Space.md },
  permissionTitle: { fontSize: Type.lg, fontWeight: '900', color: Colors.textPrimary, letterSpacing: 2 },
  permissionBody: { fontSize: Type.sm, color: Colors.textSecondary, textAlign: 'center' },
  permissionBtn: { backgroundColor: Colors.accent, borderRadius: Radii.md, paddingVertical: Space.md, paddingHorizontal: Space.xl },
  permissionBtnText: { color: Colors.textPrimary, fontWeight: '800', letterSpacing: 1.5 },

  // Top bar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Space.lg,
    zIndex: 10,
  },
  doneTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.lg,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    borderRadius: Radii.full,
    paddingHorizontal: Space.md,
    paddingVertical: Space.xs,
    gap: Space.xs,
  },
  donePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accentDim,
    borderRadius: Radii.full,
    paddingHorizontal: Space.md,
    paddingVertical: Space.xs,
    gap: Space.xs,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  doneDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accent },
  donePillText: { fontSize: Type.sm, fontWeight: '800', color: Colors.textPrimary, letterSpacing: 1 },
  doneTopSpacer: { width: 36, height: 36 },
  countdownDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.textPrimary },
  countdownText: { fontSize: Type.sm, fontWeight: '800', color: Colors.textPrimary, letterSpacing: 1 },
  cameraControls: { gap: Space.sm },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutBtn: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Space.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  checkoutBtnText: {
    color: Colors.textPrimary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  // Bottom
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: Space.sm,
    zIndex: 10,
  },
  doneContent: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.sm,
    paddingBottom: Space.lg,
    gap: Space.sm,
  },
  doneBody: {
    color: Colors.accent,
    fontSize: Type.md,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 18,
  },
  doneMetaTop: { alignItems: 'center', marginBottom: Space.xs },
  snapFrame: {
    position: 'relative',
    borderRadius: Radii.xl,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  donePrimaryImage: { width: '100%', aspectRatio: 3 / 4 },
  doneSecondaryWrap: {
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
  doneSecondaryImage: { width: '100%', height: '100%' },
  secondaryHint: {
    position: 'absolute',
    right: Space.xs,
    bottom: Space.xs,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
  },
  doneFallbackText: {
    color: Colors.textMuted,
    fontSize: Type.sm,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  doneCaption: {
    color: Colors.textSecondary,
    fontSize: Type.sm,
    lineHeight: 20,
    marginTop: Space.xs,
  },
  commentsSection: {
    paddingTop: Space.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  commentsTitle: {
    fontSize: Type.xs,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 2,
    marginBottom: Space.sm,
  },
  commentRow: { flexDirection: 'row', gap: Space.sm, marginBottom: Space.sm },
  commentAvatar: { width: 28, height: 28, borderRadius: 14 },
  avatarFallback: { backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  commentBodyWrap: { flex: 1 },
  commentUsername: { fontSize: Type.xs, fontWeight: '700', color: Colors.textPrimary },
  commentText: { fontSize: Type.sm, color: Colors.textSecondary, lineHeight: 18 },
  noComments: { color: Colors.textMuted, fontSize: Type.sm },
  inlineComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    marginBottom: Space.md,
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
  locationStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    backgroundColor: Colors.overlay,
    borderRadius: Radii.full,
    paddingHorizontal: Space.md,
    paddingVertical: Space.xs,
  },
  locationText: {
    fontSize: Type.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 1,
    maxWidth: SCREEN_WIDTH * 0.7,
  },
  recordRow: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: Space.xl,
    position: 'relative',
    minHeight: 72,
  },
  recordBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.textPrimary,
    ...Platform.select<ViewStyle>({
      web: { boxShadow: `0px 4px 10px ${Colors.accent}99` },
      default: {
        shadowColor: Colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.6,
        shadowRadius: 10,
        elevation: 8,
      },
    }),
  },
  recordBtnDisabled: { opacity: 0.6 },
  recordInner: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.textPrimary },
  checkinBtn: {
    minWidth: 164,
    height: 56,
    borderRadius: Radii.full,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Space.xl,
    borderWidth: 2,
    borderColor: Colors.textPrimary,
    ...Platform.select<ViewStyle>({
      web: { boxShadow: `0px 4px 10px ${Colors.accent}99` },
      default: {
        shadowColor: Colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
        elevation: 8,
      },
    }),
  },
  checkinBtnText: {
    color: Colors.textPrimary,
    fontSize: Type.sm,
    fontWeight: '900',
    letterSpacing: 2,
  },
  flipSmall: {
    position: 'absolute',
    right: Space.xl,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
