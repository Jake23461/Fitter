import { useEffect, useState } from 'react'
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView, StatusBar,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { supabase } from '../src/lib/supabase'
import { profilePrivacyKeys } from '../src/features/profile-privacy'
import { useAuthStore } from '../src/stores/authStore'
import { Colors, Radii, Space, Type } from '../src/tokens'
import type { UserStats } from '../src/types'

type StatForm = {
  weight_kg: string
  height_cm: string
  bench_1rm_kg: string
  squat_1rm_kg: string
  deadlift_1rm_kg: string
  ohp_1rm_kg: string
}

function toInput(value: number | null | undefined) {
  return value == null ? '' : String(value)
}

function toNumberOrNull(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : NaN
}

export default function EditStatsScreen() {
  const { session } = useAuthStore()
  const queryClient = useQueryClient()
  const insets = useSafeAreaInsets()
  const [form, setForm] = useState<StatForm>({
    weight_kg: '',
    height_cm: '',
    bench_1rm_kg: '',
    squat_1rm_kg: '',
    deadlift_1rm_kg: '',
    ohp_1rm_kg: '',
  })

  const { data: stats } = useQuery<UserStats | null>({
    queryKey: profilePrivacyKeys.userStats(session?.user.id, session?.user.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', session!.user.id)
        .maybeSingle()
      if (error) throw error
      return data ?? null
    },
    enabled: !!session,
  })

  useEffect(() => {
    if (!stats) return
    setForm({
      weight_kg: toInput(stats.weight_kg),
      height_cm: toInput(stats.height_cm),
      bench_1rm_kg: toInput(stats.bench_1rm_kg),
      squat_1rm_kg: toInput(stats.squat_1rm_kg),
      deadlift_1rm_kg: toInput(stats.deadlift_1rm_kg),
      ohp_1rm_kg: toInput(stats.ohp_1rm_kg),
    })
  }, [stats])

  const save = useMutation({
    mutationFn: async () => {
      if (!session) return

      const payload = {
        user_id: session.user.id,
        weight_kg: toNumberOrNull(form.weight_kg),
        height_cm: toNumberOrNull(form.height_cm),
        bench_1rm_kg: toNumberOrNull(form.bench_1rm_kg),
        squat_1rm_kg: toNumberOrNull(form.squat_1rm_kg),
        deadlift_1rm_kg: toNumberOrNull(form.deadlift_1rm_kg),
        ohp_1rm_kg: toNumberOrNull(form.ohp_1rm_kg),
      }

      const hasInvalid = Object.values(payload).some((value) => typeof value === 'number' && Number.isNaN(value))
      if (hasInvalid) {
        Alert.alert('Error', 'Please enter valid numbers for your stats.')
        return
      }

      const { error } = await supabase.from('user_stats').upsert(payload, { onConflict: 'user_id' })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profilePrivacyKeys.userStats(session?.user.id, session?.user.id) })
      router.back()
    },
    onError: (error) => {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not save stats.')
    },
  })

  function updateField(key: keyof StatForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.cancelBtn}>CANCEL</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>EDIT STATS</Text>
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
          <Text style={styles.sectionTitle}>BODY</Text>
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>WEIGHT (KG)</Text>
              <TextInput style={styles.input} value={form.weight_kg} onChangeText={(value) => updateField('weight_kg', value)} keyboardType="decimal-pad" />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>HEIGHT (CM)</Text>
              <TextInput style={styles.input} value={form.height_cm} onChangeText={(value) => updateField('height_cm', value)} keyboardType="decimal-pad" />
            </View>
          </View>

          <Text style={styles.sectionTitle}>MAIN LIFTS</Text>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>BENCH 1RM (KG)</Text>
            <TextInput style={styles.input} value={form.bench_1rm_kg} onChangeText={(value) => updateField('bench_1rm_kg', value)} keyboardType="decimal-pad" />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>SQUAT 1RM (KG)</Text>
            <TextInput style={styles.input} value={form.squat_1rm_kg} onChangeText={(value) => updateField('squat_1rm_kg', value)} keyboardType="decimal-pad" />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>DEADLIFT 1RM (KG)</Text>
            <TextInput style={styles.input} value={form.deadlift_1rm_kg} onChangeText={(value) => updateField('deadlift_1rm_kg', value)} keyboardType="decimal-pad" />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>OHP 1RM (KG)</Text>
            <TextInput style={styles.input} value={form.ohp_1rm_kg} onChangeText={(value) => updateField('ohp_1rm_kg', value)} keyboardType="decimal-pad" />
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
  saveBtn: { backgroundColor: Colors.accent, borderRadius: Radii.sm, paddingHorizontal: Space.md, paddingVertical: Space.xs },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: Colors.textPrimary, fontWeight: '800', fontSize: Type.sm, letterSpacing: 1 },
  scroll: { padding: Space.lg, gap: Space.md },
  sectionTitle: { color: Colors.textPrimary, fontSize: Type.lg, fontWeight: '900', marginTop: Space.sm },
  row: { flexDirection: 'row', gap: Space.md },
  halfField: { flex: 1, gap: 4 },
  field: { gap: 4 },
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
})
