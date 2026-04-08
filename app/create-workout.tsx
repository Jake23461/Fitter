import { useState } from 'react'
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView, StatusBar,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { supabase } from '../src/lib/supabase'
import { profilePrivacyKeys } from '../src/features/profile-privacy'
import { useAuthStore } from '../src/stores/authStore'
import { Colors, Radii, Space, Type } from '../src/tokens'

type ExerciseDraft = {
  id: string
  exercise_name: string
  target_sets: string
  target_reps: string
  target_weight_kg: string
}

function newExercise(index: number): ExerciseDraft {
  return {
    id: `${Date.now()}-${index}`,
    exercise_name: '',
    target_sets: '3',
    target_reps: '10',
    target_weight_kg: '',
  }
}

export default function CreateWorkoutScreen() {
  const { session } = useAuthStore()
  const queryClient = useQueryClient()
  const insets = useSafeAreaInsets()
  const [name, setName] = useState('')
  const [exercises, setExercises] = useState<ExerciseDraft[]>([newExercise(1)])

  const save = useMutation({
    mutationFn: async () => {
      if (!session) return
      if (!name.trim()) {
        Alert.alert('Error', 'Give your workout a name.')
        return
      }

      const validExercises = exercises
        .map((exercise, index) => ({
          exercise_name: exercise.exercise_name.trim(),
          target_sets: Number(exercise.target_sets),
          target_reps: Number(exercise.target_reps),
          target_weight_kg: exercise.target_weight_kg.trim() ? Number(exercise.target_weight_kg) : null,
          order_index: index,
        }))
        .filter((exercise) => exercise.exercise_name)

      if (validExercises.length === 0) {
        Alert.alert('Error', 'Add at least one exercise.')
        return
      }

      if (validExercises.some((exercise) => !Number.isFinite(exercise.target_sets) || !Number.isFinite(exercise.target_reps))) {
        Alert.alert('Error', 'Sets and reps need valid numbers.')
        return
      }

      const { data: template, error: templateError } = await supabase
        .from('workout_templates')
        .insert({ user_id: session.user.id, name: name.trim() })
        .select('id')
        .single()

      if (templateError) throw templateError

      const { error: exercisesError } = await supabase
        .from('workout_template_exercises')
        .insert(validExercises.map((exercise) => ({ ...exercise, template_id: template.id })))

      if (exercisesError) throw exercisesError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profilePrivacyKeys.workouts(session?.user.id, session?.user.id) })
      router.back()
    },
    onError: (error) => {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not create workout.')
    },
  })

  function updateExercise(id: string, key: keyof ExerciseDraft, value: string) {
    setExercises((current) => current.map((exercise) => exercise.id === id ? { ...exercise, [key]: value } : exercise))
  }

  function addExercise() {
    setExercises((current) => [...current, newExercise(current.length + 1)])
  }

  function removeExercise(id: string) {
    setExercises((current) => current.length === 1 ? current : current.filter((exercise) => exercise.id !== id))
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.cancelBtn}>CANCEL</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CREATE WORKOUT</Text>
        <TouchableOpacity onPress={() => save.mutate()} activeOpacity={0.8} disabled={save.isPending} style={[styles.saveBtn, save.isPending && styles.saveBtnDisabled]}>
          <Text style={styles.saveBtnText}>{save.isPending ? 'SAVING...' : 'SAVE'}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.bottom}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>WORKOUT NAME</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Push Day" placeholderTextColor={Colors.textMuted} />
          </View>

          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>EXERCISES</Text>
            <TouchableOpacity style={styles.addBtn} onPress={addExercise} activeOpacity={0.8}>
              <Ionicons name="add" size={16} color={Colors.textPrimary} />
              <Text style={styles.addBtnText}>ADD</Text>
            </TouchableOpacity>
          </View>

          {exercises.map((exercise, index) => (
            <View key={exercise.id} style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                <Text style={styles.exerciseTitle}>EXERCISE {index + 1}</Text>
                <TouchableOpacity onPress={() => removeExercise(exercise.id)} activeOpacity={0.7}>
                  <Ionicons name="trash-outline" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
              <TextInput style={styles.input} value={exercise.exercise_name} onChangeText={(value) => updateExercise(exercise.id, 'exercise_name', value)} placeholder="Bench Press" placeholderTextColor={Colors.textMuted} />
              <View style={styles.row}>
                <TextInput style={[styles.input, styles.smallInput]} value={exercise.target_sets} onChangeText={(value) => updateExercise(exercise.id, 'target_sets', value)} placeholder="3" placeholderTextColor={Colors.textMuted} keyboardType="number-pad" />
                <TextInput style={[styles.input, styles.smallInput]} value={exercise.target_reps} onChangeText={(value) => updateExercise(exercise.id, 'target_reps', value)} placeholder="10" placeholderTextColor={Colors.textMuted} keyboardType="number-pad" />
                <TextInput style={[styles.input, styles.smallInput]} value={exercise.target_weight_kg} onChangeText={(value) => updateExercise(exercise.id, 'target_weight_kg', value)} placeholder="60" placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad" />
              </View>
            </View>
          ))}
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
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Space.sm },
  sectionTitle: { color: Colors.textPrimary, fontSize: Type.lg, fontWeight: '900' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.accent, borderRadius: Radii.full, paddingHorizontal: Space.md, paddingVertical: Space.xs },
  addBtnText: { color: Colors.textPrimary, fontSize: Type.xs, fontWeight: '800', letterSpacing: 1 },
  exerciseCard: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radii.md, padding: Space.md, gap: Space.sm },
  exerciseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  exerciseTitle: { color: Colors.textPrimary, fontSize: Type.xs, fontWeight: '800', letterSpacing: 1 },
  row: { flexDirection: 'row', gap: Space.sm },
  smallInput: { flex: 1 },
})
