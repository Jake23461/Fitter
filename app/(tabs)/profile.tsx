import { useMemo, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, StatusBar, Dimensions, RefreshControl, NativeSyntheticEvent, NativeScrollEvent, PanResponder,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { supabase } from '../../src/lib/supabase'
import { BrandWordmark } from '../../src/components/BrandWordmark'
import {
  fetchUserSavedPosts,
  fetchUserStats,
  fetchUserWorkoutTemplates,
  profilePrivacyKeys,
} from '../../src/features/profile-privacy'
import { fetchSocialCounts, socialKeys } from '../../src/features/social'
import { useAuthStore } from '../../src/stores/authStore'
import { useTabStore } from '../../src/stores/tabStore'
import { Colors, Space, Radii, Type } from '../../src/tokens'
import { getDualSnapAssets, getPostMediaUrl } from '../../src/features/post-media'
import type { Post, UserStats, WorkoutTemplate } from '../../src/types'

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
const PROFILE_MAIN_TAB_X = SCREEN_WIDTH * 4
const NOTIFICATIONS_MAIN_TAB_X = SCREEN_WIDTH * 3

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number) {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1
}

export default function ProfileScreen() {
  const { session, profile, fetchProfile } = useAuthStore()
  const [activeTab, setActiveTab] = useState<ProfileTab>('history')
  const [refreshing, setRefreshing] = useState(false)
  const sectionPagerRef = useRef<ScrollView | null>(null)
  const dragMainPagerToX = useTabStore((state) => state.dragMainPagerToX)
  const animateMainPagerToTab = useTabStore((state) => state.animateMainPagerToTab)

  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())

  const monthLabel = new Date(calYear, calMonth).toLocaleString('default', { month: 'long', year: 'numeric' }).toUpperCase()
  const daysInMonth = getDaysInMonth(calYear, calMonth)
  const firstDow = getFirstDayOfWeek(calYear, calMonth)

  const avatarUrl = profile?.avatar_url
    ? supabase.storage.from('avatars').getPublicUrl(profile.avatar_url).data.publicUrl
    : null

  const { data: sessions = [] } = useQuery<{ session_date: string }[]>({
    queryKey: ['sessions-month', session?.user.id, calYear, calMonth],
    queryFn: async () => {
      const start = new Date(calYear, calMonth, 1).toISOString().split('T')[0]
      const end = new Date(calYear, calMonth + 1, 0).toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('gym_sessions')
        .select('session_date')
        .eq('user_id', session!.user.id)
        .gte('session_date', start)
        .lte('session_date', end)
      if (error) throw error
      return data ?? []
    },
    enabled: !!session && activeTab === 'history',
  })

  const { data: monthPosts = [] } = useQuery<Post[]>({
    queryKey: ['posts-month', session?.user.id, calYear, calMonth],
    queryFn: async () => {
      const start = new Date(calYear, calMonth, 1).toISOString().split('T')[0]
      const end = new Date(calYear, calMonth + 1, 0).toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('posts')
        .select('*, post_media(*)')
        .eq('user_id', session!.user.id)
        .gte('post_date', start)
        .lte('post_date', end)
        .eq('is_deleted', false)
      if (error) throw error
      return data ?? []
    },
    enabled: !!session && activeTab === 'history',
  })

  const { data: userStats = null } = useQuery<UserStats | null>({
    queryKey: profilePrivacyKeys.userStats(session?.user.id, session?.user.id),
    queryFn: () => fetchUserStats(session!.user.id),
    enabled: !!session && activeTab === 'stats',
  })

  const { data: workoutTemplates = [] } = useQuery<WorkoutTemplate[]>({
    queryKey: profilePrivacyKeys.workouts(session?.user.id, session?.user.id),
    queryFn: () => fetchUserWorkoutTemplates(session!.user.id),
    enabled: !!session && activeTab === 'workouts',
  })

  const { data: savedPosts = [] } = useQuery<Post[]>({
    queryKey: profilePrivacyKeys.saved(session?.user.id, session?.user.id),
    queryFn: () => fetchUserSavedPosts(session!.user.id),
    enabled: !!session && activeTab === 'saved',
  })

  const { data: socialCounts = { followerCount: 0, followingCount: 0 } } = useQuery({
    queryKey: socialKeys.counts(session?.user.id),
    queryFn: () => fetchSocialCounts(session!.user.id),
    enabled: !!session,
  })

  const activeDates = new Set(sessions.map((row) => row.session_date))
  const checkinCount = sessions.length
  const friendCount = Math.min(socialCounts.followerCount, socialCounts.followingCount)

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

  const historyEdgeSwipeResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gestureState) => (
      activeTab === 'history'
      && gestureState.dx > 12
      && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.1
    ),
    onPanResponderMove: (_, gestureState) => {
      if (activeTab !== 'history' || !dragMainPagerToX) return
      const dragX = Math.max(0, Math.min(gestureState.dx, SCREEN_WIDTH))
      const nextOffset = Math.max(NOTIFICATIONS_MAIN_TAB_X, PROFILE_MAIN_TAB_X - dragX)
      dragMainPagerToX(nextOffset)
    },
    onPanResponderRelease: (_, gestureState) => {
      if (activeTab === 'history' && gestureState.dx > 0) {
        animateMainPagerToTab?.('notifications')
        return
      }
    },
    onPanResponderTerminate: () => {
      animateMainPagerToTab?.('notifications')
    },
  }), [activeTab, animateMainPagerToTab, dragMainPagerToX])

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

  async function handleRefresh() {
    if (!session) return
    setRefreshing(true)
    await fetchProfile(session.user.id)
    setRefreshing(false)
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity activeOpacity={0.7}>
          <Ionicons name="menu" size={24} color={Colors.textSecondary} />
        </TouchableOpacity>
        <BrandWordmark color={Colors.textPrimary} />
        <View style={styles.headerRight}>
          <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/people-search' as never)}>
            <Ionicons name="search" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/edit-profile' as never)}>
            <Ionicons name="settings-outline" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Space.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.accent} />}
      >
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
            <TouchableOpacity style={styles.editBtn} activeOpacity={0.8} onPress={() => router.push('/edit-profile' as never)}>
              <Text style={styles.editBtnText}>EDIT PROFILE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareBtn} activeOpacity={0.8}>
              <Ionicons name="share-social-outline" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{profile?.total_checkins ?? 0}</Text>
            <Text style={styles.statLabel}>WORKOUTS</Text>
          </View>
          <View style={[styles.statCell, styles.statCellBorder]}>
            <Text style={styles.statValue}>{socialCounts.followerCount}</Text>
            <Text style={styles.statLabel}>FOLLOWERS</Text>
            <Text style={styles.statSubLabel}>{socialCounts.followingCount} FOLLOWING</Text>
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

        <View {...historyEdgeSwipeResponder.panHandlers}>
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
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>{monthLabel}</Text>
              <View style={styles.calendarNav}>
                <Text style={styles.calendarCheckins}>{checkinCount} CHECK-INS</Text>
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
          </View>

          <View style={[styles.sectionPage, styles.sectionPageGapSm]}>
            <View style={styles.sectionActionRow}>
              <TouchableOpacity style={styles.sectionActionBtn} activeOpacity={0.8} onPress={() => router.push('/create-workout' as never)}>
                <Ionicons name="add-circle-outline" size={14} color={Colors.textSecondary} />
                <Text style={styles.sectionActionText}>Create Workout</Text>
              </TouchableOpacity>
            </View>
            {workoutTemplates.map((template) => (
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
            ))}
            {workoutTemplates.length === 0 && <Text style={styles.emptyText}>No workouts yet. Create your first template.</Text>}
          </View>

          <View style={[styles.sectionPage, styles.sectionPageGapMd]}>
            <View style={styles.sectionActionRow}>
              <TouchableOpacity style={styles.sectionActionBtn} activeOpacity={0.8} onPress={() => router.push('/edit-stats' as never)}>
                <Ionicons name="create-outline" size={14} color={Colors.textSecondary} />
                <Text style={styles.sectionActionText}>Edit Stats</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statsPanel}>
              <Text style={styles.sectionTitle}>BODY</Text>
              <View style={styles.metricsRow}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{userStats?.weight_kg ? `${userStats.weight_kg} KG` : '—'}</Text>
                  <Text style={styles.metricLabel}>WEIGHT</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{userStats?.height_cm ? `${userStats.height_cm} CM` : '—'}</Text>
                  <Text style={styles.metricLabel}>HEIGHT</Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>MAIN LIFTS</Text>
              <View style={styles.metricsGrid}>
                <View style={styles.metricListCard}><Text style={styles.metricListValue}>{userStats?.bench_1rm_kg ? `${userStats.bench_1rm_kg} KG` : '—'}</Text><Text style={styles.metricLabel}>BENCH</Text></View>
                <View style={styles.metricListCard}><Text style={styles.metricListValue}>{userStats?.squat_1rm_kg ? `${userStats.squat_1rm_kg} KG` : '—'}</Text><Text style={styles.metricLabel}>SQUAT</Text></View>
                <View style={styles.metricListCard}><Text style={styles.metricListValue}>{userStats?.deadlift_1rm_kg ? `${userStats.deadlift_1rm_kg} KG` : '—'}</Text><Text style={styles.metricLabel}>DEADLIFT</Text></View>
                <View style={styles.metricListCard}><Text style={styles.metricListValue}>{userStats?.ohp_1rm_kg ? `${userStats.ohp_1rm_kg} KG` : '—'}</Text><Text style={styles.metricLabel}>OHP</Text></View>
              </View>
            </View>
          </View>

            <View style={styles.sectionPage}>
            {savedPosts.length > 0 ? (
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
              <Text style={[styles.emptyText, { paddingHorizontal: Space.lg }]}>Save other users' workouts and posts to keep them here.</Text>
            )}
            </View>
          </ScrollView>
        </View>
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
  headerRight: { flexDirection: 'row', gap: Space.md },
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
  editBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    paddingVertical: Space.sm,
    paddingHorizontal: Space.xl,
  },
  editBtnText: { color: Colors.textPrimary, fontSize: Type.sm, fontWeight: '700', letterSpacing: 1.5 },
  shareBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    paddingVertical: Space.sm,
    paddingHorizontal: Space.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Space.lg,
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
  sectionPage: { width: SCREEN_WIDTH, paddingHorizontal: Space.lg },
  sectionPageGapSm: { gap: Space.sm },
  sectionPageGapMd: { gap: Space.md },
  sectionActionRow: {
    alignItems: 'flex-end',
    paddingTop: Space.sm,
  },
  sectionActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: Radii.full,
    paddingVertical: 8,
    paddingHorizontal: Space.md,
    gap: Space.xs,
  },
  sectionActionText: { color: Colors.textSecondary, fontWeight: '700', fontSize: Type.xs, letterSpacing: 0.4 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Space.md,
    marginBottom: Space.sm,
    gap: Space.xs,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: Type.sm, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 1 },
  cardMeta: { fontSize: Type.xs, color: Colors.textMuted },
  cardText: { fontSize: Type.sm, color: Colors.textSecondary, lineHeight: 18 },
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
  metricCard: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radii.md,
    padding: Space.md,
    alignItems: 'center',
    gap: 4,
  },
  metricValue: { color: Colors.textPrimary, fontSize: Type.lg, fontWeight: '900' },
  metricLabel: { color: Colors.textMuted, fontSize: Type.xs, fontWeight: '700', letterSpacing: 1 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  metricListCard: {
    width: '48%',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radii.md,
    padding: Space.md,
    gap: 4,
  },
  metricListValue: { color: Colors.textPrimary, fontSize: Type.md, fontWeight: '800' },
  savedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  savedItem: { width: GRID_ITEM, aspectRatio: 1 },
  savedThumb: { width: '100%', height: '100%', borderRadius: Radii.sm },
  savedFallback: { backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: Colors.textMuted, fontSize: Type.sm, marginTop: Space.lg, textAlign: 'center' },
})
