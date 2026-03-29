import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Colors, Space, Type, Radii } from '../../tokens'

type BadgePosition = 'topRight' | 'topLeft' | 'bottomRight'
type BadgeVariant = 'dot' | 'count'

type Props = {
  count?: number
  variant?: BadgeVariant
  position?: BadgePosition
}

export function Badge({ count, variant, position = 'topRight' }: Props) {
  // Determine variant from props: explicit variant prop wins;
  // if count provided and > 0, default to count; otherwise dot
  const resolvedVariant: BadgeVariant =
    variant ?? (count !== undefined && count > 0 ? 'count' : 'dot')

  if (resolvedVariant === 'dot') {
    return <View style={[styles.dot, styles[position]]} />
  }

  return (
    <View style={[styles.badge, styles[position]]}>
      <Text style={styles.countText} numberOfLines={1}>
        {count && count > 99 ? '99+' : count}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    backgroundColor: Colors.accent,
    minWidth: 20,
    height: 20,
    borderRadius: Radii.sm,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Space.xs,
  },
  dot: {
    position: 'absolute',
    width: Space.sm,
    height: Space.sm,
    borderRadius: Radii.full,
    backgroundColor: Colors.accent,
  },
  topRight: { top: Space.sm, right: Space.sm },
  topLeft: { top: Space.sm, left: Space.sm },
  bottomRight: { bottom: Space.sm, right: Space.sm },
  countText: {
    ...Type.label,
    color: Colors.textOnAccent,
  },
})
