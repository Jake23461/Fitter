import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors, Radii, Space, Type } from '../../tokens'

export function LockedSectionCard({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons name="lock-closed" size={18} color={Colors.accent} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginTop: Space.md,
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Space.lg,
    alignItems: 'center',
    gap: Space.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: Colors.textPrimary, fontSize: Type.sm, fontWeight: '800', letterSpacing: 1 },
  body: { color: Colors.textMuted, fontSize: Type.sm, textAlign: 'center', lineHeight: 18 },
})
