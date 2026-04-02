import { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, ScrollView, Platform, Alert, StatusBar, Keyboard,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { supabase } from '../../src/lib/supabase'
import { BrandWordmark } from '../../src/components/BrandWordmark'
import { Colors, Space, Radii, Type } from '../../src/tokens'

export default function SignInScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignIn() {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Please enter your email and password.')
      return
    }
    if (loading) return
    Keyboard.dismiss()
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) Alert.alert('Error', error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
            <Text style={styles.backLabel}>← BACK</Text>
          </TouchableOpacity>

          <View style={styles.headerWrap}>
            <BrandWordmark color={Colors.textPrimary} />
            <View style={styles.logoUnderline} />
            <Text style={styles.heading}>SIGN IN</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>EMAIL</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>PASSWORD</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleSignIn}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              activeOpacity={0.8}
              onPress={handleSignIn}
              disabled={loading}
            >
              <Text style={styles.submitBtnText}>{loading ? 'SIGNING IN...' : 'SIGN IN'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => router.push('/(auth)/sign-up')} style={styles.switchRow}>
            <Text style={styles.switchText}>
              No account? <Text style={styles.switchLink}>CREATE ONE</Text>
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: Space.lg, paddingBottom: Space['2xl'] },
  backRow: { paddingTop: Space.md, marginBottom: Space.xl },
  backLabel: { color: Colors.textSecondary, fontSize: Type.sm, fontWeight: '700', letterSpacing: 1.5 },
  headerWrap: { alignItems: 'center', marginBottom: Space['2xl'] },
  logoUnderline: { width: 40, height: 3, backgroundColor: Colors.accent, marginTop: Space.xs, marginBottom: Space.lg },
  heading: { fontSize: Type['2xl'], fontWeight: '900', color: Colors.textPrimary, letterSpacing: 3, textAlign: 'center' },
  form: { gap: Space.md },
  field: { gap: Space.xs },
  fieldLabel: { fontSize: Type.xs, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 2 },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Space.md,
    color: Colors.textPrimary,
    fontSize: Type.md,
  },
  submitBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radii.md,
    paddingVertical: Space.md,
    alignItems: 'center',
    marginTop: Space.sm,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: Colors.textPrimary, fontSize: Type.md, fontWeight: '800', letterSpacing: 2 },
  switchRow: { alignItems: 'center', marginTop: Space.xl },
  switchText: { color: Colors.textSecondary, fontSize: Type.sm },
  switchLink: { color: Colors.accent, fontWeight: '700' },
})
