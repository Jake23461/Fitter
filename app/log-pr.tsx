import { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, StatusBar, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../src/lib/supabase'
import { useAuthStore } from '../src/stores/authStore'
import { Colors, Space, Radii, Type } from '../src/tokens'

const COMMON_EXERCISES = [
  'Bench Press', 'Squat', 'Deadlift', 'Overhead Press',
  'Pull-up', 'Barbell Row', 'Incline Bench', 'Romanian Deadlift',
]

export default function LogPrScreen() {
  const { session } = useAuthStore()
  const queryClient = useQueryClient()
  const insets = useSafeAreaInsets()

  const [exercise, setExercise] = useState('')
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [notes, setNotes] = useState('')

  const logPr = useMutation({
    mutationFn: async () => {
      if (!session) return
      const weightNum = parseFloat(weight)
      const repsNum = parseInt(reps, 10)
      if (!exercise.trim()) {
        Alert.alert('Error', 'Please enter an exercise name.')
        return
      }
      if (isNaN(weightNum) || weightNum <= 0) {
        Alert.alert('Error', 'Please enter a valid weight.')
        return
      }
      if (isNaN(repsNum) || repsNum <= 0) {
        Alert.alert('Error', 'Please enter a valid rep count.')
        return
      }
      const { error } = await supabase.from('pr_entries').insert({
        user_id: session.user.id,
        exercise_name: exercise.trim(),
        weight_kg: weightNum,
        reps: repsNum,
        notes: notes.trim() || null,
        logged_at: new Date().toISOString(),
      })
      if (error) {
        Alert.alert('Error', error.message)
        return
      }
      queryClient.invalidateQueries({ queryKey: ['prs'] })
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
        <Text style={styles.headerTitle}>LOG PR</Text>
        <TouchableOpacity
          onPress={() => logPr.mutate()}
          activeOpacity={0.8}
          disabled={logPr.isPending}
          style={[styles.saveBtn, logPr.isPending && styles.saveBtnDisabled]}
        >
          <Text style={styles.saveBtnText}>{logPr.isPending ? 'SAVING...' : 'SAVE'}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.bottom}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Trophy icon */}
          <View style={styles.iconWrap}>
            <Ionicons name="trophy" size={32} color={Colors.accent} />
          </View>
          <Text style={styles.subtitle}>Record your personal record.</Text>

          {/* Quick exercise chips */}
          <Text style={styles.fieldLabel}>EXERCISE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {COMMON_EXERCISES.map(ex => (
              <TouchableOpacity
                key={ex}
                style={[styles.chip, exercise === ex && styles.chipActive]}
                onPress={() => setExercise(ex)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, exercise === ex && styles.chipTextActive]}>{ex}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TextInput
            style={styles.input}
            value={exercise}
            onChangeText={setExercise}
            placeholder="Or type custom exercise..."
            placeholderTextColor={Colors.textMuted}
            autoCorrect={false}
            returnKeyType="next"
          />

          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>WEIGHT (KG)</Text>
              <TextInput
                style={styles.input}
                value={weight}
                onChangeText={setWeight}
                placeholder="100"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
                returnKeyType="next"
              />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>REPS</Text>
              <TextInput
                style={styles.input}
                value={reps}
                onChangeText={setReps}
                placeholder="5"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                returnKeyType="next"
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>NOTES <Text style={styles.optional}>(OPTIONAL)</Text></Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="All-time best, competition lift..."
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={200}
            returnKeyType="done"
          />

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
  headerTitle: { fontSize: Type.md, fontWeight: '900', color: Colors.textPrimary, letterSpacing: 3 },
  cancelBtn: { color: Colors.textSecondary, fontSize: Type.sm, fontWeight: '700' },
  saveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radii.sm,
    paddingHorizontal: Space.md,
    paddingVertical: Space.xs,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: Colors.textPrimary, fontWeight: '800', fontSize: Type.sm, letterSpacing: 1 },

  scroll: { padding: Space.lg, gap: Space.md },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: Space.xs,
  },
  subtitle: { color: Colors.textSecondary, fontSize: Type.sm, textAlign: 'center', marginBottom: Space.sm },

  fieldLabel: { fontSize: Type.xs, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 2, marginBottom: 4 },
  optional: { color: Colors.textMuted, fontWeight: '400' },

  chipsRow: { gap: Space.xs, paddingBottom: Space.sm },
  chip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.full,
    paddingHorizontal: Space.md,
    paddingVertical: Space.xs,
  },
  chipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipText: { color: Colors.textMuted, fontSize: Type.xs, fontWeight: '700' },
  chipTextActive: { color: Colors.textPrimary },

  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Space.md,
    color: Colors.textPrimary,
    fontSize: Type.md,
  },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },

  row: { flexDirection: 'row', gap: Space.md },
  halfField: { flex: 1, gap: 4 },
})
