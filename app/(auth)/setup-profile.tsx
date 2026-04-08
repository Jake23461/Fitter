import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, Alert, StatusBar, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { supabase } from '../../src/lib/supabase'
import { BrandWordmark } from '../../src/components/BrandWordmark'
import { useAuthStore } from '../../src/stores/authStore'
import { Colors, Space, Radii, Type } from '../../src/tokens'

export default function SetupProfileScreen() {
  const { session, fetchProfile } = useAuthStore()
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUri, setAvatarUri] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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

  async function handleSave() {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Please enter a display name.')
      return
    }
    if (!session?.user) return
    setLoading(true)
    try {
      let avatarUrl: string | null = null

      if (avatarUri) {
        const ext = avatarUri.split('.').pop() ?? 'jpg'
        const normalizedExt = ext.toLowerCase() === 'jpeg' ? 'jpg' : ext.toLowerCase()
        const fileName = `${session.user.id}/avatar.${normalizedExt}`
        const response = await fetch(avatarUri)
        const blob = await response.blob()
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, blob, { upsert: true, contentType: `image/${normalizedExt}` })
        if (!uploadError) {
          // Store the storage path, not the full URL — display code builds URLs via getPublicUrl
          avatarUrl = fileName
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim(),
          bio: bio.trim() || null,
          ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
        })
        .eq('id', session.user.id)

      if (error) {
        Alert.alert('Error', error.message)
        return
      }

      await fetchProfile(session.user.id)
      router.replace('/(tabs)/feed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <View style={styles.logo}>
            <BrandWordmark color={Colors.textPrimary} />
          </View>
          <View style={styles.logoUnderline} />
          <Text style={styles.heading}>SET UP PROFILE</Text>
          <Text style={styles.subheading}>You can always change this later.</Text>

          {/* Avatar picker */}
          <TouchableOpacity style={styles.avatarWrap} onPress={pickAvatar} activeOpacity={0.8}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={40} color={Colors.textMuted} />
              </View>
            )}
            <View style={styles.avatarBadge}>
              <Ionicons name="camera" size={14} color={Colors.textPrimary} />
            </View>
          </TouchableOpacity>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>DISPLAY NAME</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Alex Storm"
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
                placeholder="In the gym every day."
                placeholderTextColor={Colors.textMuted}
                multiline
                maxLength={160}
                returnKeyType="done"
              />
              <Text style={styles.charCount}>{bio.length}/160</Text>
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              activeOpacity={0.8}
              onPress={handleSave}
              disabled={loading}
            >
              <Text style={styles.submitBtnText}>{loading ? 'SAVING...' : "LET'S GO"}</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: Space.lg, paddingBottom: Space['2xl'] },
  logo: { marginTop: Space.xl },
  logoUnderline: { width: 40, height: 3, backgroundColor: Colors.accent, marginTop: Space.xs, marginBottom: Space.lg },
  heading: { fontSize: Type['2xl'], fontWeight: '900', color: Colors.textPrimary, letterSpacing: 2 },
  subheading: { color: Colors.textMuted, fontSize: Type.sm, marginTop: Space.xs, marginBottom: Space.xl },
  avatarWrap: {
    alignSelf: 'center',
    marginBottom: Space.xl,
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: { gap: Space.md },
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
  bioInput: { height: 88, textAlignVertical: 'top' },
  charCount: { color: Colors.textMuted, fontSize: Type.xs, alignSelf: 'flex-end' },
  submitBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radii.md,
    paddingVertical: Space.md,
    alignItems: 'center',
    marginTop: Space.sm,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: Colors.textPrimary, fontSize: Type.md, fontWeight: '800', letterSpacing: 2 },
})
