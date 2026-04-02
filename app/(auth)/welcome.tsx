import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { BrandWordmark } from '../../src/components/BrandWordmark'
import { Colors, Space, Radii, Type } from '../../src/tokens'

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>

        {/* Logo area */}
        <View style={styles.logoArea}>
          <BrandWordmark size="hero" color={Colors.textPrimary} />
          <View style={styles.logoUnderline} />
          <Text style={styles.tagline}>THE GYM IS YOUR STAGE.</Text>
        </View>

        {/* Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryBtn}
            activeOpacity={0.8}
            onPress={() => router.push('/(auth)/sign-up')}
          >
            <Text style={styles.primaryBtnText}>CREATE ACCOUNT</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            activeOpacity={0.8}
            onPress={() => router.push('/(auth)/sign-in')}
          >
            <Text style={styles.secondaryBtnText}>SIGN IN</Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: Space.lg,
    justifyContent: 'space-between',
    paddingBottom: Space['2xl'],
  },
  logoArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingTop: Space['2xl'],
  },
  logoUnderline: {
    width: 56,
    height: 3,
    backgroundColor: Colors.accent,
    marginTop: Space.xs,
    marginBottom: Space.lg,
  },
  tagline: {
    fontSize: Type.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 2.5,
  },
  actions: {
    gap: Space.sm,
  },
  primaryBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radii.md,
    paddingVertical: Space.md,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: Colors.textPrimary,
    fontSize: Type.md,
    fontWeight: '800',
    letterSpacing: 2,
  },
  secondaryBtn: {
    backgroundColor: 'transparent',
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Space.md,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: Colors.textSecondary,
    fontSize: Type.md,
    fontWeight: '700',
    letterSpacing: 2,
  },
})
