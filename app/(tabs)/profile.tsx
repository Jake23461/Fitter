import { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, StatusBar, Dimensions, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { supabase } from '../../src/lib/supabase'
import { BrandWordmark } from '../../src/components/BrandWordmark'
import { useAuthStore } from '../../src/stores/authStore'
import { Colors, Space, Radii, Type } from '../../src/tokens'
import { getDualSnapAssets, getPostMediaUrl } from '../../src/features/post-media'
import type { PrEntry, Post } from '../../src/types'

type ProfileTab = 'history' | 'workouts' | 'prs' | 'saved'
const PROFILE_TABS: { key: ProfileTab; label: string }[] = [
  { key: 'history', label: 'HISTORY' },
  { key: 'workouts', label: 'WORKOUTS' },
  { key: 'prs', label: 'PRS' },
  { key: 'saved', label: 'SAVED' },
]

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CALENDAR_DAY = (SCREEN_WIDTH - Space.lg * 2 - Space.sm * 6) / 7

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfWeek(year: number, month: number) {
  // 0=Sun, shift to Mon-based (Mon=0)
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1
}

export default function ProfileScreen() {
  const { session, profile, signOut, fetchProfile } = useAuthStore()
  const [activeTab, setActiveTab] = useState<ProfileTab>('history')
  const [refreshing, setRefreshing] = useState(false)

  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())

  const monthLabel = new Date(calYear, calMonth).toLocaleString('default', { month: 'long', year: 'numeric' }).toUpperCase()
  const daysInMonth = getDaysInMonth(calYear, calMonth)
  const firstDow = getFirstDayOfWeek(calYear, calMonth)

  const avatarUrl = profile?.avatar_url
    ? supabase.storage.from('avatars').getPublicUrl(profile.avatar_url).data.publicUrl
    : null

  // Checkin sessions this month (for calendar dots)
  const { data: sessions = [] } = useQuery<{ session_date: string }[]>({
    queryKey: ['sessions-month', session?.user.id, calYear, calMonth],
    queryFn: async () => {
      const start = new Date(calYear, calMonth, 1).toISOString().split('T')[0]
      const end = new Date(calYear, calMonth + 1, 0).toISOString().split('T')[0]
      const { data } = await supabase
        .from('gym_sessions')
        .select('session_date')
        .eq('user_id', session!.user.id)
        .gte('session_date', start)
        .lte('session_date', end)
      return data ?? []
    },
    enabled: !!session,
  })

  // Posts for calendar thumbnails
  const { data: monthPosts = [] } = useQuery<Post[]>({
    queryKey: ['posts-month', session?.user.id, calYear, calMonth],
    queryFn: async () => {
      const start = new Date(calYear, calMonth, 1).toISOString().split('T')[0]
      const end = new Date(calYear, calMonth + 1, 0).toISOString().split('T')[0]
      const { data } = await supabase
        .from('posts')
        .select('*, post_media(*)')
        .eq('user_id', session!.user.id)
        .gte('post_date', start)
        .lte('post_date', end)
        .eq('is_deleted', false)
      return data ?? []
    },
    enabled: !!session && activeTab === 'history',
  })

  // PRs
  const { data: prs = [] } = useQuery<PrEntry[]>({
    queryKey: ['prs', session?.user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('pr_entries')
        .select('*')
        .eq('user_id', session!.user.id)
        .order('logged_at', { ascending: false })
        .limit(20)
      return data ?? []
    },
    enabled: !!session,
  })

  const activeDates = new Set(sessions.map(s => s.session_date))
  const checkinCount = sessions.length

  function getPostForDay(day: number): Post | undefined {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return monthPosts.find(p => p.post_date === dateStr)
  }

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
    else setCalMonth(m => m - 1)
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(m => m + 1)
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

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity activeOpacity={0.7}>
          <Ionicons name="menu" size={24} color={Colors.textSecondary} />
        </TouchableOpacity>
        <BrandWordmark color={Colors.textPrimary} />
        <View style={styles.headerRight}>
          <TouchableOpacity activeOpacity={0.7}>
            <Ionicons name="search" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} onPress={() => useAuthStore.getState().signOut()}>
            <Ionicons name="settings-outline" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Space.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.accent} />}
      >

        {/* Avatar + name */}
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
          <Text style={styles.username}>{profile?.username?.toUpperCase() ?? 'ATHLETE'}</Text>
          <Text style={styles.subtitle}>ELITE ATHLETE{profile ? '' : ''}</Text>

          <View style={styles.profileBtns}>
            <TouchableOpacity style={styles.editBtn} activeOpacity={0.8} onPress={() => router.push('/edit-profile' as never)}>
              <Text style={styles.editBtnText}>EDIT PROFILE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareBtn} activeOpacity={0.8}>
              <Ionicons name="share-social-outline" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{profile?.total_checkins ?? 0}</Text>
            <Text style={styles.statLabel}>WORKOUTS</Text>
          </View>
          <View style={[styles.statCell, styles.statCellBorder]}>
            <Text style={styles.statValue}>—</Text>
            <Text style={styles.statLabel}>LIFTED</Text>
            <Text style={styles.statSubLabel}>POUNDS</Text>
          </View>
          <View style={styles.statCell}>
            <View style={styles.streakRow}>
              <Text style={styles.statValue}>{profile?.streak_current ?? 0}</Text>
              <Ionicons name="flame" size={18} color={Colors.accent} style={{ marginLeft: 4 }} />
            </View>
            <Text style={styles.statLabel}>STREAK</Text>
          </View>
        </View>

        {/* Profile tabs */}
        <View style={styles.tabRow}>
          {PROFILE_TABS.map(t => (
            <TouchableOpacity key={t.key} style={styles.profileTab} onPress={() => setActiveTab(t.key)} activeOpacity={0.7}>
              <Text style={[styles.tabLabel, activeTab === t.key && styles.tabLabelActive]}>{t.label}</Text>
              {activeTab === t.key && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        {activeTab === 'history' && (
          <View style={{ paddingHorizontal: Space.lg }}>
            {/* Calendar */}
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

            {/* Day of week header */}
            <View style={styles.dowRow}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                <Text key={i} style={styles.dowLabel}>{d}</Text>
              ))}
            </View>

            {/* Calendar grid */}
            <View style={styles.calGrid}>
              {Array.from({ length: firstDow }).map((_, i) => (
                <View key={`empty-${i}`} style={styles.calCell} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
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
                    {thumb ? (
                      <Image source={{ uri: thumb }} style={styles.calThumb} />
                    ) : null}
                    <Text style={[styles.calDay, isActive && styles.calDayActive, thumb && styles.calDayOnPhoto]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {/* Recent Best */}
            {prs.length > 0 && (
              <View style={{ marginTop: Space.xl }}>
                <Text style={styles.recentBestTitle}>RECENT BEST</Text>
                <View style={styles.prCard}>
                  <View style={styles.prCardLeft}>
                    <View style={styles.prIconWrap}>
                      <Ionicons name="trophy" size={16} color={Colors.accent} />
                    </View>
                    <View>
                      <Text style={styles.prExercise}>{prs[0].exercise_name.toUpperCase()}</Text>
                      <Text style={styles.prWeight}>{prs[0].weight_kg} KG</Text>
                    </View>
                  </View>
                  <View style={styles.prNewBadge}>
                    <Text style={styles.prNewText}>NEW PR</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {activeTab === 'prs' && (
          <View style={{ paddingHorizontal: Space.lg, gap: Space.sm }}>
            <TouchableOpacity
              style={styles.logPrBtn}
              activeOpacity={0.85}
              onPress={() => router.push('/log-pr' as never)}
            >
              <Ionicons name="add-circle-outline" size={18} color={Colors.textPrimary} />
              <Text style={styles.logPrBtnText}>LOG NEW PR</Text>
            </TouchableOpacity>
            {prs.map(pr => (
              <View key={pr.id} style={styles.prCard}>
                <View style={styles.prCardLeft}>
                  <View style={styles.prIconWrap}>
                    <Ionicons name="barbell-outline" size={16} color={Colors.accent} />
                  </View>
                  <View>
                    <Text style={styles.prExercise}>{pr.exercise_name.toUpperCase()}</Text>
                    <Text style={styles.prWeight}>{pr.weight_kg} KG × {pr.reps}</Text>
                  </View>
                </View>
                <Text style={styles.prDate}>{new Date(pr.logged_at).toLocaleDateString()}</Text>
              </View>
            ))}
            {prs.length === 0 && <Text style={styles.emptyText}>No PRs logged yet. Log your first!</Text>}
          </View>
        )}

        {(activeTab === 'workouts' || activeTab === 'saved') && (
          <Text style={[styles.emptyText, { paddingHorizontal: Space.lg }]}>Coming soon.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  // Header
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

  // Avatar section
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

  // Stats grid
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

  // Profile tabs
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border, marginTop: Space.lg },
  profileTab: { flex: 1, alignItems: 'center', paddingVertical: Space.sm },
  tabLabel: { fontSize: Type.xs, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1 },
  tabLabelActive: { color: Colors.textPrimary },
  tabUnderline: { position: 'absolute', bottom: 0, left: Space.sm, right: Space.sm, height: 2, backgroundColor: Colors.accent },

  // Calendar
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
  dowLabel: {
    width: CALENDAR_DAY,
    textAlign: 'center',
    fontSize: Type.xs,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
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

  // Recent Best / PR card
  recentBestTitle: { fontSize: Type.lg, fontWeight: '900', color: Colors.textPrimary, marginBottom: Space.sm },
  prCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space.sm,
  },
  prCardLeft: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  prIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prExercise: { fontSize: Type.sm, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 1 },
  prWeight: { fontSize: Type['2xl'], fontWeight: '900', color: Colors.textPrimary },
  prNewBadge: { backgroundColor: Colors.accent, borderRadius: Radii.xs, paddingHorizontal: Space.sm, paddingVertical: 2 },
  prNewText: { fontSize: Type.xs, fontWeight: '800', color: Colors.textPrimary, letterSpacing: 1 },
  prDate: { fontSize: Type.xs, color: Colors.textMuted },

  emptyText: { color: Colors.textMuted, fontSize: Type.sm, marginTop: Space.lg },
  logPrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: Radii.md,
    paddingVertical: Space.sm,
    gap: Space.xs,
  },
  logPrBtnText: { color: Colors.textPrimary, fontWeight: '800', fontSize: Type.sm, letterSpacing: 1.5 },
})
