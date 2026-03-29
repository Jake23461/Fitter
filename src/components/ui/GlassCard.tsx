import React from 'react'
import { View, StyleSheet, ViewStyle } from 'react-native'
import { BlurView } from 'expo-blur'
import { Colors, Glass, Radii } from '../../tokens'

type BlurVariant = 'subtle' | 'card' | 'overlay' | 'tabBar'
type FallbackVariant = 'rgba' | 'solid'

type Props = {
  children: React.ReactNode
  blur?: BlurVariant
  fallback?: FallbackVariant
  style?: ViewStyle
}

export function GlassCard({
  children,
  blur = 'card',
  fallback = 'rgba',
  style,
}: Props) {
  const intensity = Glass[blur]

  return (
    <BlurView intensity={intensity} tint={Colors.blurTint} style={styles.blurView}>
      <View
        style={[
          styles.container,
          fallback === 'solid' && styles.solidFallback,
          style,
        ]}
      >
        {children}
      </View>
    </BlurView>
  )
}

const styles = StyleSheet.create({
  blurView: {
    borderRadius: Radii.md,
    overflow: 'hidden',
  },
  container: {
    backgroundColor: Colors.glassTint,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: Radii.md,
  },
  solidFallback: {
    backgroundColor: Colors.surface,
  },
})
