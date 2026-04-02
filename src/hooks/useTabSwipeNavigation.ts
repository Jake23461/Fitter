import { useMemo } from 'react'
import { PanResponder, Platform } from 'react-native'
import { router } from 'expo-router'

const TAB_ORDER = ['map', 'feed', 'checkin', 'notifications', 'profile'] as const
const SWIPE_DISTANCE = 72
const SWIPE_ACTIVATION = 20

export function useTabSwipeNavigation(currentTab: (typeof TAB_ORDER)[number]) {
  return useMemo(() => {
    if (Platform.OS === 'web') return {}

    const currentIndex = TAB_ORDER.indexOf(currentTab)

    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => (
        Math.abs(gestureState.dx) > SWIPE_ACTIVATION
        && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.25
      ),
      onPanResponderRelease: (_, gestureState) => {
        if (Math.abs(gestureState.dy) > Math.abs(gestureState.dx)) return

        if (gestureState.dx <= -SWIPE_DISTANCE && currentIndex < TAB_ORDER.length - 1) {
          router.navigate(`/(tabs)/${TAB_ORDER[currentIndex + 1]}` as never)
        }

        if (gestureState.dx >= SWIPE_DISTANCE && currentIndex > 0) {
          router.navigate(`/(tabs)/${TAB_ORDER[currentIndex - 1]}` as never)
        }
      },
    }).panHandlers
  }, [currentTab])
}
