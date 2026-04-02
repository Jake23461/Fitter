import { useEffect, useMemo, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  ScrollView, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native'
import type { ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import type { ComponentProps } from 'react'
import { usePathname, useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../src/lib/supabase'
import { useAuthStore } from '../../src/stores/authStore'
import { Colors, Space, Radii, Type } from '../../src/tokens'
import MapScreen from './map'
import FeedScreen from './feed'
import CheckinScreen from './checkin'
import NotificationsScreen from './notifications'
import ProfileScreen from './profile'

const SHADOW_ACCENT: ViewStyle = Platform.select({
  web: { boxShadow: '0px 4px 10px rgba(229,24,58,0.55)' } as ViewStyle,
  default: {
    shadowColor: '#E5183A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 10,
  },
})!

const TAB_CONFIG = [
  { name: 'map', label: 'MAP', icon: 'map-outline', href: '/(tabs)/map', component: MapScreen },
  { name: 'feed', label: 'HOME', icon: 'home-outline', href: '/(tabs)/feed', component: FeedScreen },
  { name: 'checkin', label: 'CHECK-IN', icon: 'camera', href: '/(tabs)/checkin', center: true, component: CheckinScreen },
  { name: 'notifications', label: 'ALERTS', icon: 'notifications-outline', href: '/(tabs)/notifications', component: NotificationsScreen },
  { name: 'profile', label: 'PROFILE', icon: 'person-outline', href: '/(tabs)/profile', component: ProfileScreen },
] as const

function getTabIndex(pathname: string) {
  const matchedIndex = TAB_CONFIG.findIndex(tab => pathname === tab.href || pathname.startsWith(`${tab.href}/`))
  return matchedIndex >= 0 ? matchedIndex : 0
}

function CustomTabBar({
  currentIndex,
  onSelect,
}: {
  currentIndex: number
  onSelect: (index: number) => void
}) {
  const insets = useSafeAreaInsets()
  const barHeight = 60
  const { session } = useAuthStore()
  const { width } = useWindowDimensions()

  const { data: unreadCount = 0 } = useQuery<number>({
    queryKey: ['notif-unread', session?.user.id],
    queryFn: async () => {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session!.user.id)
        .eq('is_read', false)
      return count ?? 0
    },
    enabled: !!session,
    refetchInterval: 30_000,
  })

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom }]}>
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.centerButton, { left: width / 2 - 32, bottom: insets.bottom + barHeight / 2 - 32 }]}
        onPress={() => onSelect(2)}
      >
        <Ionicons name="camera" size={26} color={Colors.textPrimary} />
      </TouchableOpacity>

      <View style={[styles.bar, { height: barHeight }]}>
        {TAB_CONFIG.map((tab, index) => {
          const isFocused = currentIndex === index

          if ('center' in tab && tab.center) {
            return (
              <View key={tab.name} style={styles.tab}>
                <Text style={[styles.label, isFocused ? styles.labelActive : styles.labelInactive]}>
                  {tab.label}
                </Text>
              </View>
            )
          }

          return (
            <TouchableOpacity key={tab.name} onPress={() => onSelect(index)} style={styles.tab} activeOpacity={0.7}>
              <View style={[styles.tabInner, !isFocused && styles.tabInnerInactive]}>
                <View style={styles.iconWrap}>
                  <Ionicons
                    name={tab.icon as ComponentProps<typeof Ionicons>['name']}
                    size={18}
                    color={isFocused ? Colors.accent : Colors.textMuted}
                  />
                  {tab.name === 'notifications' && unreadCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.label, isFocused ? styles.labelActive : styles.labelInactive]}>
                  {tab.label}
                </Text>
              </View>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

export default function TabLayout() {
  const pathname = usePathname()
  const router = useRouter()
  const { width } = useWindowDimensions()
  const scrollRef = useRef<ScrollView | null>(null)
  const lastIndexRef = useRef<number | null>(null)
  const currentIndex = useMemo(() => getTabIndex(pathname), [pathname])

  useEffect(() => {
    if (!width) return

    const animated = lastIndexRef.current !== null
    scrollRef.current?.scrollTo({ x: currentIndex * width, animated })
    lastIndexRef.current = currentIndex
  }, [currentIndex, width])

  function navigateToIndex(index: number) {
    const nextTab = TAB_CONFIG[index]
    if (!nextTab) return
    scrollRef.current?.scrollTo({ x: index * width, animated: true })
    if (pathname !== nextTab.href) {
      router.replace(nextTab.href as never)
    }
  }

  function handleMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!width) return
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width)
    const nextTab = TAB_CONFIG[nextIndex]
    if (nextTab && pathname !== nextTab.href) {
      router.replace(nextTab.href as never)
    }
  }

  return (
    <View style={styles.layout}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        directionalLockEnabled
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleMomentumEnd}
        style={styles.pager}
        contentContainerStyle={styles.pagerContent}
      >
        {TAB_CONFIG.map(tab => {
          const ScreenComponent = tab.component
          return (
            <View key={tab.name} style={[styles.page, { width }]}>
              <ScreenComponent />
            </View>
          )
        })}
      </ScrollView>

      <CustomTabBar currentIndex={currentIndex} onSelect={navigateToIndex} />
    </View>
  )
}

const styles = StyleSheet.create({
  layout: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  pager: {
    flex: 1,
  },
  pagerContent: {
    flexGrow: 1,
  },
  page: {
    flex: 1,
  },
  wrapper: {
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    overflow: 'visible',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: Space.xs,
    paddingHorizontal: Space.sm,
    borderRadius: Radii.xs,
  },
  tabInnerInactive: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  label: {
    fontSize: Type.xs - 1,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  labelActive: {
    color: Colors.accent,
  },
  labelInactive: {
    color: Colors.textMuted,
  },
  iconWrap: { position: 'relative' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  badgeText: { color: Colors.textPrimary, fontSize: 8, fontWeight: '900' },
  centerButton: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    ...SHADOW_ACCENT,
  },
})
