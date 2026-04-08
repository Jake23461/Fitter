import { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, Image, StatusBar,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useAuthStore } from '../src/stores/authStore'
import { Colors, Radii, Space, Type } from '../src/tokens'
import { openProfile } from '../src/features/profile-navigation'
import {
  getSocialActionLabel,
  invalidateSocialState,
  searchProfiles,
  showSocialError,
  socialKeys,
  toggleFollow,
} from '../src/features/social'
import { supabase } from '../src/lib/supabase'
import type { SocialProfileSearchResult } from '../src/types'

function SearchRow({
  item,
  onToggleFollow,
}: {
  item: SocialProfileSearchResult
  onToggleFollow: (item: SocialProfileSearchResult) => void
}) {
  const avatarUrl = item.avatar_url
    ? supabase.storage.from('avatars').getPublicUrl(item.avatar_url).data.publicUrl
    : null

  return (
    <TouchableOpacity
      style={styles.resultRow}
      activeOpacity={0.85}
      onPress={() => openProfile(item.id)}
    >
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Ionicons name="person" size={18} color={Colors.textMuted} />
        </View>
      )}

      <View style={styles.resultBody}>
        <Text style={styles.displayName}>{item.display_name || item.username}</Text>
        <Text style={styles.username}>@{item.username}</Text>
      </View>

      <TouchableOpacity
        style={[styles.followBtn, item.isFollowing && styles.followingBtn]}
        activeOpacity={0.8}
        onPress={() => onToggleFollow(item)}
      >
        <Text style={[styles.followBtnText, item.isFollowing && styles.followingBtnText]}>
          {getSocialActionLabel(item)}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  )
}

export default function PeopleSearchScreen() {
  const { session } = useAuthStore()
  const queryClient = useQueryClient()
  const [term, setTerm] = useState('')

  const { data: results = [], isLoading } = useQuery<SocialProfileSearchResult[]>({
    queryKey: socialKeys.search(session?.user.id, term.trim()),
    queryFn: () => searchProfiles(session!.user.id, term),
    enabled: !!session,
  })

  const followMutation = useMutation({
    mutationFn: async (profile: SocialProfileSearchResult) => {
      await toggleFollow(session!.user.id, profile.id, profile.isFollowing)
    },
    onSuccess: (_, profile) => {
      if (!session) return
      invalidateSocialState(queryClient, session.user.id, profile.id)
      queryClient.invalidateQueries({ queryKey: socialKeys.search(session.user.id, term.trim()) })
    },
    onError: showSocialError,
  })

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PEOPLE</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={term}
          onChangeText={setTerm}
          placeholder="Search by username or name"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {term.length > 0 && (
          <TouchableOpacity onPress={() => setTerm('')} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SearchRow item={item} onToggleFollow={(profile) => followMutation.mutate(profile)} />
        )}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {isLoading ? 'Searching...' : term.trim() ? 'No people found.' : 'Search for athletes to follow.'}
          </Text>
        }
      />
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
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    margin: Space.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Type.sm,
  },
  listContent: { paddingHorizontal: Space.lg, paddingBottom: Space.xl },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingVertical: Space.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: Colors.accent },
  avatarFallback: {
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultBody: { flex: 1 },
  displayName: { color: Colors.textPrimary, fontSize: Type.sm, fontWeight: '700' },
  username: { color: Colors.textMuted, fontSize: Type.xs, marginTop: 2 },
  followBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radii.full,
    paddingHorizontal: Space.md,
    paddingVertical: Space.xs,
  },
  followingBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  followBtnText: { color: Colors.textPrimary, fontSize: Type.xs, fontWeight: '800', letterSpacing: 1 },
  followingBtnText: { color: Colors.textSecondary },
  emptyText: {
    color: Colors.textMuted,
    fontSize: Type.sm,
    textAlign: 'center',
    marginTop: Space.xl,
  },
})
