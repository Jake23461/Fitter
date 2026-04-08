import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Image, Alert, StatusBar, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../src/lib/supabase'
import {
  DEFAULT_PROFILE_PRIVACY,
  fetchProfilePrivacySettings,
  getVisibilityLabel,
  profilePrivacyKeys,
  upsertProfilePrivacySettings,
} from '../src/features/profile-privacy'
import { useAuthStore } from '../src/stores/authStore'
import { Colors, Space, Radii, Type } from '../src/tokens'
import type { ProfileVisibility } from '../src/types'

const PRIVACY_FIELDS = [
  { key: 'stats_visibility', label: 'Stats', description: 'Lift stats, body data, and PR history.' },
  { key: 'calendar_visibility', label: 'Calendar', description: 'Your check-in calendar and snaps.' },
  { key: 'saved_visibility', label: 'Saved', description: 'Saved workouts and posts you keep.' },
  { key: 'workouts_visibility', label: 'Workouts', description: 'Workout templates on your profile.' },
] as const

const VISIBILITY_OPTIONS: ProfileVisibility[] = ['public', 'friends', 'private']

export default function EditProfileScreen() {
  const { session, profile, fetchProfile } = useAuthStore()
  const queryClient = useQueryClient()
  const insets = useSafeAreaInsets()

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [avatarUri, setAvatarUri] = useState<string | null>(null)
  const [privacy, setPrivacy] = useState(DEFAULT_PROFILE_PRIVACY)

  const { data: privacySettings } = useQuery({
    queryKey: profilePrivacyKeys.settings(session?.user.id),
    queryFn: () => fetchProfilePrivacySettings(session!.user.id),
    enabled: !!session,
  })

  useEffect(() => {
    if (!privacySettings) return
    setPrivacy({
      stats_visibility: privacySettings.stats_visibility,
      calendar_visibility: privacySettings.calendar_visibility,
      saved_visibility: privacySettings.saved_visibility,
      workouts_visibility: privacySettings.workouts_visibility,
    })
  }, [privacySettings])

  const currentAvatarUrl = profile?.avatar_url
    ? supabase.storage.from('avatars').getPublicUrl(profile.avatar_url).data.publicUrl
    : null

  async function pickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri)
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!session?.user) return
      if (!displayName.trim()) {
        Alert.alert('Error', 'Display name cannot be empty.')
        return
      }

      let avatarPath: string | undefined

      if (avatarUri) {
        const response = await fetch(avatarUri)
        const arrayBuffer = await response.arrayBuffer()
        const uriExt = avatarUri.split('?')[0].split('.').pop()?.toLowerCase()
        const extMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }
        const mimeType = (uriExt && extMap[uriExt]) ?? 'image/jpeg'
        const ext = mimeType.split('/')[1].replace('jpeg', 'jpg')
        const fileName = `${session.user.id}/avatar.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, arrayBuffer, { upsert: true, contentType: mimeType })
        if (uploadError) { Alert.alert('Upload failed', uploadError.message); return }
        avatarPath = fileName
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim(),
          bio: bio.trim() || null,
          ...(avatarPath ? { avatar_url: avatarPath } : {}),
        })
        .eq('id', session.user.id)

      if (error) { Alert.alert('Error', error.message); return }

      await upsertProfilePrivacySettings({
        user_id: session.user.id,
        ...privacy,
      })

      await fetchProfile(session.user.id)
      queryClient.invalidateQueries({ queryKey: ['profile', session.user.id] })
      queryClient.invalidateQueries({ queryKey: profilePrivacyKeys.settings(session.user.id) })
      router.back()
    },
  })

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.cancelBtn}>CANCEL</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>EDIT PROFILE</Text>
        <TouchableOpacity
          onPress={() => save.mutate()}
          activeOpacity={0.8}
          disabled={save.isPending}
          style={[styles.saveBtn, save.isPending && styles.saveBtnDisabled]}
        >
          <Text style={styles.saveBtnText}>{save.isPending ? 'SAVING...' : 'SAVE'}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.bottom}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Avatar */}
          <TouchableOpacity style={styles.avatarWrap} onPress={pickAvatar} activeOpacity={0.8}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : currentAvatarUrl ? (
              <Image source={{ uri: currentAvatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Ionicons name="person" size={40} color={Colors.textMuted} />
              </View>
            )}
            <View style={styles.avatarBadge}>
              <Ionicons name="camera" size={14} color={Colors.textPrimary} />
            </View>
          </TouchableOpacity>

          <Text style={styles.avatarHint}>TAP TO CHANGE PHOTO</Text>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>DISPLAY NAME</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                placeholderTextColor={Colors.textMuted}
                autoCorrect={false}
                maxLength={40}
                returnKeyType="next"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>BIO <Text style={styles.optional}>(OPTIONAL)</Text></Text>
              <TextInput
                style={[styles.input, styles.bioInput]}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell people about yourself..."
                placeholderTextColor={Colors.textMuted}
                multiline
                maxLength={160}
                returnKeyType="done"
              />
              <Text style={styles.charCount}>{bio.length}/160</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>PROFILE VISIBILITY</Text>
              <Text style={styles.fieldHint}>
                Choose who can see each part of your profile. `Public` means any signed-in user, `Friends` means mutual follows, and `Private` means only you.
              </Text>
              <View style={styles.privacyGroup}>
                {PRIVACY_FIELDS.map((field) => (
                  <View key={field.key} style={styles.privacyRow}>
                    <View style={styles.privacyHeadingRow}>
                      <Text style={styles.privacyLabel}>{field.label.toUpperCase()}</Text>
                      <Text style={styles.privacyDescription}>{field.description}</Text>
                    </View>
                    <View style={styles.privacyOptions}>
                      {VISIBILITY_OPTIONS.map((option) => {
                        const isActive = privacy[field.key] === option
                        return (
                          <TouchableOpacity
                            key={option}
                            style={[styles.privacyChip, isActive && styles.privacyChipActive]}
                            activeOpacity={0.8}
                            onPress={() => setPrivacy((current) => ({ ...current, [field.key]: option }))}
                          >
                            <Text style={[styles.privacyChipText, isActive && styles.privacyChipTextActive]}>
                              {getVisibilityLabel(option)}
                            </Text>
                          </TouchableOpacity>
                        )
                      })}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
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
    paddingVertical: Space.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: Type.md, fontWeight: '900', color: Colors.textPrimary, letterSpacing: 2 },
  cancelBtn: { color: Colors.textSecondary, fontSize: Type.sm, fontWeight: '700' },
  saveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radii.sm,
    paddingHorizontal: Space.md,
    paddingVertical: Space.xs,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: Colors.textPrimary, fontWeight: '800', fontSize: Type.sm, letterSpacing: 1 },

  scroll: { padding: Space.lg, alignItems: 'center', gap: Space.md },

  avatarWrap: { position: 'relative', marginTop: Space.md },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  avatarFallback: {
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHint: {
    fontSize: Type.xs,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: Space.sm,
  },

  form: { width: '100%', gap: Space.md },
  field: { gap: Space.xs },
  fieldLabel: { fontSize: Type.xs, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 2 },
  fieldHint: { color: Colors.textMuted, fontSize: Type.sm, lineHeight: 18, marginBottom: Space.xs },
  optional: { color: Colors.textMuted, fontWeight: '400' },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Space.md,
    color: Colors.textPrimary,
    fontSize: Type.md,
  },
  bioInput: { minHeight: 80, textAlignVertical: 'top' },
  charCount: { color: Colors.textMuted, fontSize: Type.xs, alignSelf: 'flex-end' },
  privacyGroup: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Space.md,
    gap: Space.md,
  },
  privacyRow: { gap: Space.xs },
  privacyHeadingRow: { gap: 2 },
  privacyLabel: { color: Colors.textPrimary, fontSize: Type.xs, fontWeight: '700', letterSpacing: 1 },
  privacyDescription: { color: Colors.textMuted, fontSize: Type.xs, lineHeight: 16 },
  privacyOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.xs },
  privacyChip: {
    paddingHorizontal: Space.sm,
    paddingVertical: Space.xs,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  privacyChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  privacyChipText: { color: Colors.textSecondary, fontSize: Type.xs, fontWeight: '700', letterSpacing: 0.8 },
  privacyChipTextActive: { color: Colors.textPrimary },
})
