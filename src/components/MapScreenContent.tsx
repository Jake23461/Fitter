import { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  StatusBar, Dimensions, Platform,
} from 'react-native'
import type { ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { Colors, Space, Radii, Type } from '../tokens'
import type { Gym } from '../types'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

const PIN_POSITIONS = [
  { x: 0.35, y: 0.42 },
  { x: 0.65, y: 0.6 },
  { x: 0.2, y: 0.65 },
  { x: 0.75, y: 0.35 },
]

const INTENSITY = 62

export function MapScreenContent() {
  const insets = useSafeAreaInsets()
  const { session } = useAuthStore()
  const [search, setSearch] = useState('')

  const { data: gyms = [] } = useQuery<Gym[]>({
    queryKey: ['gyms-all'],
    queryFn: async () => {
      const { data } = await supabase.from('gyms').select('*').limit(20)
      return data ?? []
    },
    enabled: !!session,
    staleTime: 300_000,
  })

  const filtered = search.trim()
    ? gyms.filter(gym => gym.name.toLowerCase().includes(search.toLowerCase()))
    : gyms

  return (
    <View style={styles.fill}>
      <StatusBar barStyle="light-content" />

      <View style={styles.mapBg}>
        <View style={[styles.gridOverlay, { pointerEvents: 'none' }]}>
          {Array.from({ length: 12 }).map((_, row) =>
            Array.from({ length: 8 }).map((__, col) => (
              <View
                key={`${row}-${col}`}
                style={[
                  styles.gridCell,
                  {
                    left: col * (SCREEN_WIDTH / 7) - SCREEN_WIDTH * 0.07,
                    top: row * 72 - 36,
                  },
                ]}
              />
            ))
          )}
        </View>

        <View style={[styles.radialGlow, { pointerEvents: 'none' }]} />

        {filtered.slice(0, PIN_POSITIONS.length).map((gym, index) => {
          const pos = PIN_POSITIONS[index % PIN_POSITIONS.length]
          return (
            <TouchableOpacity
              key={gym.id}
              style={[styles.pinWrap, { left: pos.x * SCREEN_WIDTH - 40, top: pos.y * SCREEN_HEIGHT - 30 }]}
              activeOpacity={0.8}
              onPress={() => router.push('/(tabs)/checkin')}
            >
              <View style={styles.pinAvatarCluster}>
                <View style={styles.pinAvatar} />
                <View style={[styles.pinAvatar, styles.pinAvatarBehind]} />
                <View style={styles.pinCountBadge}>
                  <Text style={styles.pinCountText}>+{Math.floor(Math.random() * 15) + 1}</Text>
                </View>
              </View>
              <View style={styles.pinLabel}>
                <Text style={styles.pinLabelText} numberOfLines={1}>{gym.name.toUpperCase()}</Text>
              </View>
            </TouchableOpacity>
          )
        })}
      </View>

      <View style={[styles.searchRow, { top: insets.top + Space.sm }]}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="FIND A SQUAD OR BOX..."
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Space.sm }]}>
        <View style={styles.intensityWrap}>
          <Text style={styles.intensityLabel}>LIVE INTENSITY</Text>
          <View style={styles.intensityTrack}>
            <View style={[styles.intensityFill, { width: `${INTENSITY}%` }]} />
          </View>
          <View style={styles.intensityEndLabels}>
            <Text style={styles.intensityEndText}>CHILL</Text>
            <Text style={styles.intensityEndText}>CRUSHING IT</Text>
          </View>
        </View>
      </View>

      <View style={[styles.fabStack, { bottom: insets.bottom + 100 }]}>
        <TouchableOpacity style={styles.fab} activeOpacity={0.8}>
          <Ionicons name="locate" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.fab, styles.fabSmall]} activeOpacity={0.8}>
          <Ionicons name="layers-outline" size={18} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#1A0505' },
  mapBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1A0505',
    overflow: 'hidden',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  gridCell: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderWidth: 0.5,
    borderColor: 'rgba(229,24,58,0.08)',
    transform: [{ rotate: '45deg' }],
  },
  radialGlow: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_WIDTH * 0.8,
    borderRadius: SCREEN_WIDTH * 0.4,
    top: SCREEN_HEIGHT * 0.15,
    left: SCREEN_WIDTH * 0.1,
    backgroundColor: 'rgba(229,24,58,0.12)',
  },
  pinWrap: { position: 'absolute', alignItems: 'center', gap: 3 },
  pinAvatarCluster: { flexDirection: 'row', alignItems: 'center' },
  pinAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  pinAvatarBehind: { marginLeft: -10, zIndex: -1 },
  pinCountBadge: {
    backgroundColor: Colors.textPrimary,
    borderRadius: Radii.full,
    paddingHorizontal: Space.xs,
    paddingVertical: 1,
    marginLeft: -4,
    zIndex: 1,
  },
  pinCountText: { fontSize: 10, fontWeight: '800', color: Colors.background },
  pinLabel: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.full,
    paddingHorizontal: Space.sm,
    paddingVertical: 2,
  },
  pinLabelText: { fontSize: 9, fontWeight: '700', color: Colors.textPrimary, letterSpacing: 0.5 },
  searchRow: { position: 'absolute', left: Space.lg, right: Space.lg },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26,5,5,0.9)',
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    gap: Space.sm,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: Type.sm, fontWeight: '600', letterSpacing: 1 },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Space.lg,
    paddingTop: Space.sm,
    backgroundColor: 'rgba(13,5,5,0.85)',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  intensityWrap: { gap: Space.xs },
  intensityLabel: { fontSize: Type.xs, fontWeight: '700', color: Colors.textMuted, letterSpacing: 2 },
  intensityTrack: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  intensityFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },
  intensityEndLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  intensityEndText: { fontSize: 9, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1 },
  fabStack: { position: 'absolute', right: Space.lg, gap: Space.sm },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select<ViewStyle>({
      web: { boxShadow: '0px 3px 8px rgba(229,24,58,0.4)' },
      default: {
        shadowColor: Colors.accent,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 6,
      },
    }),
  },
  fabSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignSelf: 'flex-end',
  },
})
