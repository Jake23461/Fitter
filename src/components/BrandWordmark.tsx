import { StyleProp, StyleSheet, Text, TextStyle, View } from 'react-native'
import { Colors } from '../tokens'

type BrandWordmarkProps = {
  size?: 'hero' | 'header'
  color?: string
  style?: StyleProp<TextStyle>
}

const SIZE_STYLES = {
  hero: {
    fontSize: 52,
    letterSpacing: 6,
    lineHeight: 56,
  },
  header: {
    fontSize: 20,
    letterSpacing: 4.5,
    lineHeight: 24,
  },
} as const

export function BrandWordmark({
  size = 'header',
  color = Colors.textPrimary,
  style,
}: BrandWordmarkProps) {
  const sizeStyle = SIZE_STYLES[size]

  return (
    <View style={styles.wrap}>
      <Text style={[styles.wordmarkBase, sizeStyle, styles.wordmarkShadow, style]}>DIALED</Text>
      <Text style={[styles.wordmarkBase, sizeStyle, { color }, style]}>DIALED</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    position: 'relative',
  },
  wordmarkBase: {
    fontWeight: '900',
    fontStyle: 'italic',
    textTransform: 'uppercase',
  },
  wordmarkShadow: {
    position: 'absolute',
    left: 1.5,
    top: 1.5,
    color: Colors.accent,
    opacity: 0.95,
  },
})
