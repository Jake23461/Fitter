import { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, StatusBar, Dimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../src/lib/supabase'
import { LockedSectionCard } from '../../src/components/profile/LockedSectionCard'
import {
  canViewProfileSection,
  fetchProfilePrivacySettings,
  fetchUserSavedPosts,
  fetchUserStats,
  fetchUserWorkoutTemplates,
  getLockedSectionCopy,
  profilePrivacyKeys,
} from '../../src/features/profile-privacy'
import {
  fetchSocialCounts,
  fetchSocialRelationship,
  invalidateSocialState,
  showSocialError,
  socialKeys,
  toggleFollow,
} from '../../src/features/social'
import { useAuthStore } from '../../src/stores/authStore'
import { Colors, Space, Radii, Type } from '../../src/tokens'
import { getDualSnapAssets, getPostMediaUrl } from '../../src/features/post-media'
import type {
  Post,
  Profile,
  ProfilePrivacySettings,
  SocialRelationship,
  UserStats,
  WorkoutTemplate,
} from '../../src/types'

type ProfileTab = 'history' | 'workouts' | 'stats' | 'saved'
const PROFILE_TABS: { key: ProfileTab; label: string }[] = [
  { key: 'history', label: 'HISTORY' },
  { key: 'workouts', label: 'WORKOUTS' },
  { key: 'stats', label: 'STATS' },
  { key: 'saved', label: 'SAVED' },
]

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CALENDAR_DAY = (SCREEN_WIDTH - Space.lg * 2 - Space.sm * 6) / 7
const GRID_ITEM = (SCREEN_WIDTH - Space.lg * 2 - Space.sm * 2) / 3
const PROFILE_TAB_KEYS = PROFILE_TABS.map((tab) => tab.key)

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number) {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  )
}

export default function OtherProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { session } = useAuthStore()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<ProfileTab>('history')
  const sectionPagerRef = useRef<ScrollView | null>(null)
  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const isSelf = session?.user.id === id

  useEffect(() => {
    if (isSelf) router.replace('/(tabs)/profile')
  }, [isSelf])

  const monthLabel = new Date(calYear, calMonth).toLocaleString('default', { month: 'long', year: 'numeric' }).toUpperCase()
  const daysInMonth = getDaysInMonth(calYear, calMonth)
  const firstDow = getFirstDayOfWeek(calYear, calMonth)

  const { data: profile } = useQuery<Profile | null>({
    queryKey: ['profile', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single()
      if (error) throw error
      return data ?? null
    },
    enabled: !!id,
  })

  const { data: relationship = { isFollowing: false, isFollowedBy: false, isFriend: false } } = useQuery<SocialRelationship>({
    queryKey: socialKeys.relationship(session?.user.id, id),
    queryFn: () => fetchSocialRelationship(session!.user.id, id),
    enabled: !!session && !!id && !isSelf,
  })

  const { data: counts = { followerCount: 0, followingCount: 0 } } = useQuery({
    queryKey: socialKeys.counts(id),
    queryFn: () => fetchSocialCounts(id),
    enabled: !!id,
  })

  const { data: privacy } = useQuery<ProfilePrivacySettings>({
    queryKey: profilePrivacyKeys.settings(id),
    queryFn: () => fetchProfilePrivacySettings(id),
    enabled: !!id,
  })

  const canViewStats = canViewProfileSection({ isSelf, relationship, visibility: privacy?.stats_visibility ?? 'public' })
  const canViewCalendar = canViewProfileSection({ isSelf, relationship, visibility: privacy?.calendar_visibility ?? 'public' })
  const canViewSaved = canViewProfileSection({ isSelf, relationship, visibility: privacy?.saved_visibility ?? 'private' })
  const canViewWorkouts = canViewProfileSection({ isSelf, relationship, visibility: privacy?.workouts_visibility ?? 'private' })

  const { data: sessions = [] } = useQuery<{ session_date: string }[]>({
    queryKey: profilePrivacyKeys.history(session?.user.id, id, calYear, calMonth),
    queryFn: async () => {
      const start = new Date(calYear, calMonth, 1).toISOString().split('T')[0]
      const end = new Date(calYear, calMonth + 1, 0).toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('gym_sessions')
        .select('session_date')
        .eq('user_id', id)
        .gte('session_date', start)
        .lte('session_date', end)
      if (error) throw error
      return data ?? []
    },
    enabled: !!id && canViewCalendar,
  })

  const { data: monthPosts = [] } = useQuery<Post[]>({
    queryKey: ['profile-posts-month', id, calYear, calMonth],
    queryFn: async () => {
      const start = new Date(calYear, calMonth, 1).toISOString().split('T')[0]
      const end = new Date(calYear, calMonth + 1, 0).toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('posts')
        .select('*, post_media(*)')
        .eq('user_id', id)
        .gte('post_date', start)
        .lte('post_date', end)
        .eq('is_deleted', false)
      if (error) throw error
      return data ?? []
    },
    enabled: !!id && canViewCalendar,
  })

  const { data: userStats = null } = useQuery<UserStats | null>({
    queryKey: profilePrivacyKeys.userStats(session?.user.id, id),
    queryFn: () => fetchUserStats(id),
    enabled: !!id && activeTab === 'stats' && canViewStats,
  })

  const { data: workoutTemplates = [] } = useQuery<WorkoutTemplate[]>({
    queryKey: profilePrivacyKeys.workouts(session?.user.id, id),
    queryFn: () => fetchUserWorkoutTemplates(id),
    enabled: !!id && activeTab === 'workouts' && canViewWorkouts,
  })

  const { data: savedPosts = [] } = useQuery<Post[]>({
    queryKey: profilePrivacyKeys.saved(session?.user.id, id),
    queryFn: () => fetchUserSavedPosts(id),
    enabled: !!id && activeTab === 'saved' && canViewSaved,
  })

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!session) return
      await toggleFollow(session.user.id, id, relationship.isFollowing)
    },
    onSuccess: () => {
      if (!session) return
      invalidateSocialState(queryClient, session.user.id, id)
    },
    onError: showSocialError,
  })

  if (isSelf) return null

  const avatarUrl = profile?.avatar_url
    ? supabase.storage.from('avatars').getPublicUrl(profile.avatar_url).data.publicUrl
    : null

  const activeDates = new Set(sessions.map((row) => row.session_date))
  const friendCount = Math.min(counts.followerCount, counts.followingCount)
  const primaryLabel = relationship.isFriend ? 'FRIENDS' : relationship.isFollowing ? 'FOLLOWING' : 'FOLLOW'

  function handleTabPress(tab: ProfileTab) {
    const index = PROFILE_TAB_KEYS.indexOf(tab)
    setActiveTab(tab)
    sectionPagerRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true })
  }

  function handleSectionMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH)
    const nextTab = PROFILE_TAB_KEYS[nextIndex]
    if (nextTab) setActiveTab(nextTab)
  }

  function handleSectionScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH)
    const nextTab = PROFILE_TAB_KEYS[nextIndex]
    if (nextTab && nextTab !== activeTab) setActiveTab(nextTab)
  }

  function getPostForDay(day: number): Post | undefined {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return monthPosts.find((post) => post.post_date === dateStr)
  }

  function prevMonth() {
    if (calMonth === 0) { setCalYear((year) => year - 1); setCalMonth(11) }
    else setCalMonth((month) => month - 1)
  }

  function nextMonth() {
    if (calMonth === 11) { setCalYear((year) => year + 1); setCalMonth(0) }
    else setCalMonth((month) => month + 1)
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{profile?.username?.toUpperCase() ?? 'ATHLETE'}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Space.xl }}>
        <View style={styles.avatarSection}>
          <View style={styles.avatarRingWrap}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
            ) : (
              <View style={[styles.avatarImg, styles.avatarFallback]}>
                <Ionicons name="person" size={36} color={Colors.textMuted} />
              </View>
            )}
            <View style={styles.lightningBadge}>
              <Ionicons name="flash" size={12} color={Colors.textPrimary} />
            </View>
          </View>

          <Text style={styles.username}>{(profile?.display_name ?? profile?.username ?? 'FITTER ATHLETE').toUpperCase()}</Text>
          <Text style={styles.subtitle}>@{profile?.username ?? 'athlete'}</Text>
          {!!profile?.bio && <Text style={styles.bioText}>{profile.bio}</Text>}

          <View style={styles.profileBtns}>
            <TouchableOpacity
              style={[styles.followBtn, relationship.isFollowing && styles.followingBtn]}
              activeOpacity={0.8}
              onPress={() => followMutation.mutate()}
              disabled={followMutation.isPending}
            >
              <Text style={[styles.followBtnText, relationship.isFollowing && styles.followingBtnText]}>{primaryLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{profile?.total_checkins ?? 0}</Text>
            <Text style={styles.statLabel}>WORKOUTS</Text>
          </View>
          <View style={[styles.statCell, styles.statCellBorder]}>
            <Text style={styles.statValue}>{counts.followerCount}</Text>
            <Text style={styles.statLabel}>FOLLOWERS</Text>
            <Text style={styles.statSubLabel}>{counts.followingCount} FOLLOWING</Text>
          </View>
          <View style={styles.statCell}>
            <View style={styles.streakRow}>
              <Text style={styles.statValue}>{profile?.streak_current ?? 0}</Text>
              <Ionicons name="flame" size={18} color={Colors.accent} style={{ marginLeft: 4 }} />
            </View>
            <Text style={styles.statLabel}>STREAK</Text>
            <Text style={styles.statSubLabel}>{friendCount} FRIENDS</Text>
          </View>
        </View>

        <View style={styles.tabRow}>
          {PROFILE_TABS.map((tab) => (
            <TouchableOpacity key={tab.key} style={styles.profileTab} onPress={() => handleTabPress(tab.key)} activeOpacity={0.7}>
              <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
              {activeTab === tab.key && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView
          ref={sectionPagerRef}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          directionalLockEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          onScroll={handleSectionScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={handleSectionMomentumEnd}
        >
          <View style={styles.sectionPage}>
            {canViewCalendar ? (
              <>
                <View style={styles.calendarHeader}>
                  <Text style={styles.calendarTitle}>{monthLabel}</Text>
                  <View style={styles.calendarNav}>
                    <Text style={styles.calendarCheckins}>{sessions.length} CHECK-INS</Text>
                    <TouchableOpacity onPress={prevMonth} activeOpacity={0.7}>
                      <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={nextMonth} activeOpacity={0.7}>
                      <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.dowRow}>
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, index) => (
                    <Text key={index} style={styles.dowLabel}>{label}</Text>
                  ))}
                </View>

                <View style={styles.calGrid}>
                  {Array.from({ length: firstDow }).map((_, index) => (
                    <View key={`empty-${index}`} style={styles.calCell} />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, index) => {
                    const day = index + 1
                    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                    const isActive = activeDates.has(dateStr)
                    const post = getPostForDay(day)
                    const thumb = getPostMediaUrl(getDualSnapAssets(post?.post_media).primary?.storage_path)
                    const isToday = dateStr === now.toISOString().split('T')[0]

                    return (
                      <TouchableOpacity
                        key={day}
                        style={[styles.calCell, isActive && styles.calCellActive, isToday && styles.calCellToday]}
                        activeOpacity={thumb ? 0.8 : 1}
                        onPress={() => { if (post) router.push(`/post/${post.id}` as never) }}
                      >
                        {thumb ? <Image source={{ uri: thumb }} style={styles.calThumb} /> : null}
                        <Text style={[styles.calDay, isActive && styles.calDayActive, thumb && styles.calDayOnPhoto]}>{day}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
                {sessions.length === 0 && <Text style={styles.emptyText}>No check-ins shared for this month.</Text>}
              </>
            ) : (
              <LockedSectionCard title="HISTORY LOCKED" body={getLockedSectionCopy(privacy?.calendar_visibility ?? 'public', isSelf)} />
            )}
          </View>

          <View style={styles.sectionPage}>
            {canViewWorkouts ? (
              workoutTemplates.length > 0 ? (
                workoutTemplates.map((template) => (
                  <View key={template.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle}>{template.name.toUpperCase()}</Text>
                      <Text style={styles.cardMeta}>{template.exercises?.length ?? 0} EXERCISES</Text>
                    </View>
                    {(template.exercises ?? []).slice(0, 4).map((exercise) => (
                      <Text key={exercise.id} style={styles.cardText}>
                        {exercise.exercise_name.toUpperCase()} · {exercise.target_sets} × {exercise.target_reps}
                      </Text>
                    ))}
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No workouts shared yet.</Text>
              )
            ) : (
              <LockedSectionCard title="WORKOUTS LOCKED" body={getLockedSectionCopy(privacy?.workouts_visibility ?? 'private', isSelf)} />
            )}
          </View>

          <View style={styles.sectionPage}>
            {canViewStats ? (
              <>
                <View style={styles.statsPanel}>
                  <Text style={styles.sectionTitle}>BODY</Text>
                  <View style={styles.metricsRow}>
                    <MetricCard label="WEIGHT" value={userStats?.weight_kg ? `${userStats.weight_kg} KG` : '—'} />
                    <MetricCard label="HEIGHT" value={userStats?.height_cm ? `${userStats.height_cm} CM` : '—'} />
                  </View>
                  <Text style={styles.sectionTitle}>MAIN LIFTS</Text>
                  <View style={styles.metricsGrid}>
                    <MetricCard label="BENCH" value={userStats?.bench_1rm_kg ? `${userStats.bench_1rm_kg} KG` : '—'} />
                    <MetricCard label="SQUAT" value={userStats?.squat_1rm_kg ? `${userStats.squat_1rm_kg} KG` : '—'} />
                    <MetricCard label="DEADLIFT" value={userStats?.deadlift_1rm_kg ? `${userStats.deadlift_1rm_kg} KG` : '—'} />
                    <MetricCard label="OHP" value={userStats?.ohp_1rm_kg ? `${userStats.ohp_1rm_kg} KG` : '—'} />
                  </View>
                </View>
              </>
            ) : (
              <LockedSectionCard title="STATS LOCKED" body={getLockedSectionCopy(privacy?.stats_visibility ?? 'public', isSelf)} />
            )}
          </View>

          <View style={styles.sectionPage}>
            {canViewSaved ? (
              savedPosts.length > 0 ? (
                <View style={styles.savedGrid}>
                  {savedPosts.map((post) => {
                    const thumb = getPostMediaUrl(getDualSnapAssets(post.post_media).primary?.storage_path)
                    return (
                      <TouchableOpacity
                        key={post.id}
                        style={styles.savedItem}
                        activeOpacity={0.85}
                        onPress={() => router.push(`/post/${post.id}` as never)}
                      >
                        {thumb ? (
                          <Image source={{ uri: thumb }} style={styles.savedThumb} />
                        ) : (
                          <View style={[styles.savedThumb, styles.savedFallback]}>
                            <Ionicons name="image-outline" size={20} color={Colors.textMuted} />
                          </View>
                        )}
                      </TouchableOpacity>
                    )
                  })}
                </View>
              ) : (
                <Text style={styles.emptyText}>No saved workouts shared yet.</Text>
              )
            ) : (
              <LockedSectionCard title="SAVED LOCKED" body={getLockedSectionCopy(privacy?.saved_visibility ?? 'private', isSelf)} />
            )}
          </View>
        </ScrollView>
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
  avatarSection: { alignItems: 'center', paddingTop: Space.xl, paddingBottom: Space.lg, gap: Space.sm },
  avatarRingWrap: { position: 'relative' },
  avatarImg: { width: 90, height: 90, borderRadius: 45, borderWidth: 2.5, borderColor: Colors.accent },
  avatarFallback: { backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  lightningBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  username: { fontSize: Type.xl, fontWeight: '900', color: Colors.textPrimary, letterSpacing: 2 },
  subtitle: { fontSize: Type.xs, fontWeight: '600', color: Colors.textSecondary, letterSpacing: 2 },
  bioText: { color: Colors.textSecondary, fontSize: Type.sm, textAlign: 'center', paddingHorizontal: Space.xl, lineHeight: 20 },
  profileBtns: { flexDirection: 'row', gap: Space.sm, marginTop: Space.xs },
  followBtn: { backgroundColor: Colors.accent, borderRadius: Radii.md, paddingVertical: Space.sm, paddingHorizontal: Space.xl },
  followingBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.border },
  followBtnText: { color: Colors.textPrimary, fontSize: Type.sm, fontWeight: '700', letterSpacing: 1.5 },
  followingBtnText: { color: Colors.textSecondary },
  statsGrid: {
    flexDirection: 'row',
    marginHorizontal: Space.lg,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  statCell: { flex: 1, padding: Space.md, alignItems: 'center' },
  statCellBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: Colors.accent },
  statValue: { fontSize: Type['2xl'], fontWeight: '900', color: Colors.accent },
  statLabel: { fontSize: Type.xs, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 1 },
  statSubLabel: { fontSize: 9, color: Colors.textMuted, letterSpacing: 1 },
  streakRow: { flexDirection: 'row', alignItems: 'center' },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border, marginTop: Space.lg },
  profileTab: { flex: 1, alignItems: 'center', paddingVertical: Space.sm },
  tabLabel: { fontSize: Type.xs, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1 },
  tabLabelActive: { color: Colors.textPrimary },
  tabUnderline: { position: 'absolute', bottom: 0, left: Space.sm, right: Space.sm, height: 2, backgroundColor: Colors.accent },
  sectionPage: { width: SCREEN_WIDTH, paddingHorizontal: Space.lg, paddingTop: Space.lg },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space.sm,
  },
  calendarTitle: { fontSize: Type.lg, fontWeight: '900', color: Colors.textPrimary },
  calendarNav: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  calendarCheckins: { fontSize: Type.xs, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1 },
  dowRow: { flexDirection: 'row', marginBottom: Space.xs },
  dowLabel: { width: CALENDAR_DAY, textAlign: 'center', fontSize: Type.xs, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5 },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: {
    width: CALENDAR_DAY,
    height: CALENDAR_DAY,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.xs,
    marginBottom: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  calCellActive: { backgroundColor: Colors.surface },
  calCellToday: { borderWidth: 1.5, borderColor: Colors.accent },
  calThumb: { position: 'absolute', width: '100%', height: '100%' },
  calDay: { fontSize: Type.xs, fontWeight: '600', color: Colors.textMuted },
  calDayActive: { color: Colors.textPrimary },
  calDayOnPhoto: { color: Colors.textPrimary, fontWeight: '800', zIndex: 1 },
  statsPanel: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Space.md,
    gap: Space.md,
  },
  sectionTitle: { fontSize: Type.lg, fontWeight: '900', color: Colors.textPrimary },
  metricsRow: { flexDirection: 'row', gap: Space.sm },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  metricCard: {
    width: '48%',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radii.md,
    padding: Space.md,
    alignItems: 'center',
    gap: 4,
  },
  metricValue: { color: Colors.textPrimary, fontSize: Type.lg, fontWeight: '900' },
  metricLabel: { color: Colors.textMuted, fontSize: Type.xs, fontWeight: '700', letterSpacing: 1 },
  card: { backgroundColor: Colors.surface, borderRadius: Radii.md, padding: Space.md, marginBottom: Space.sm, gap: Space.xs },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: Type.sm, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 1 },
  cardMeta: { fontSize: Type.xs, color: Colors.textMuted },
  cardText: { fontSize: Type.sm, color: Colors.textSecondary, lineHeight: 18 },
  savedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  savedItem: { width: GRID_ITEM, aspectRatio: 1 },
  savedThumb: { width: '100%', height: '100%', borderRadius: Radii.sm },
  savedFallback: { backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: Colors.textMuted, fontSize: Type.sm, marginTop: Space.lg, textAlign: 'center' },
})
