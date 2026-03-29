import React from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'
import { Colors, Layout, Radii, Type } from '../../tokens'

type AvatarSize = 'sm' | 'md' | 'lg'

type Props = {
  uri?: string
  initials?: string
  size?: AvatarSize
  isActive?: boolean
  style?: object
}

const SIZE_MAP: Record<AvatarSize, number> = {
  sm: Layout.avatarSm,
  md: Layout.avatarMd,
  lg: Layout.avatarLg,
}

export function Avatar({ uri, initials, size = 'md', isActive = false, style }: Props) {
  const sizeValue = SIZE_MAP[size]

  return (
    <View
      style={[
        styles.container,
        { width: sizeValue, height: sizeValue, borderRadius: sizeValue / 2 },
        isActive && styles.activeRingContainer,
        style,
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={[styles.image, { width: sizeValue, height: sizeValue }]}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.initialsContainer}>
          <Text style={styles.initialsText} numberOfLines={1}>
            {(initials ?? '?').slice(0, 2).toUpperCase()}
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.glassSpecular,
    backgroundColor: Colors.skeletonBase,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeRingContainer: {
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  image: {
    borderRadius: Radii.full,
  },
  initialsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    width: '100%',
  },
  initialsText: {
    ...Type.label,
    color: Colors.accent,
    fontWeight: '800',
  },
})
