import React from 'react'
import { View, StyleSheet, ViewStyle } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { Colors, Duration, Radii } from '../../tokens'

type Props = {
  width: number
  height: number
  borderRadius?: number
  style?: ViewStyle
}

export function SkeletonBlock({
  width,
  height,
  borderRadius = Radii.md,
  style,
}: Props) {
  const shimmerTranslate = useSharedValue(-width)

  React.useEffect(() => {
    shimmerTranslate.value = withRepeat(
      withTiming(width + 100, {
        duration: Duration.skeleton,
        easing: Easing.linear,
      }),
      -1
    )
  }, [shimmerTranslate, width])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerTranslate.value }],
  }))

  return (
    <View style={[styles.base, { width, height, borderRadius }, style]}>
      <Animated.View
        style={[
          { position: 'absolute', width: width + 100, height },
          animatedStyle,
        ]}
      >
        <LinearGradient
          colors={[
            Colors.skeletonBase,
            Colors.skeletonHighlight,
            Colors.skeletonBase,
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: '100%', height: '100%' }}
        />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.skeletonBase,
    overflow: 'hidden',
  },
})
