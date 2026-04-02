import { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Image, Alert, StatusBar, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../src/lib/supabase'
import { useAuthStore } from '../src/stores/authStore'
import { Colors, Space, Radii, Type } from '../src/tokens'

export default function EditProfileScreen() {
  const { session, profile, fetchProfile } = useAuthStore()
  const queryClient = useQueryClient()
  const insets = useSafeAreaInsets()

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [avatarUri, setAvatarUri] = useState<string | null>(null)

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
        const fileName = `${session.user.id}.${ext}`
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

      await fetchProfile(session.user.id)
      queryClient.invalidateQueries({ queryKey: ['profile', session.user.id] })
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
})
