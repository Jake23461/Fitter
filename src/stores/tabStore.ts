import { create } from 'zustand'

export type TabName = 'map' | 'feed' | 'checkin' | 'notifications' | 'profile'

type TabStore = {
  activeTab: TabName
  setActiveTab: (tab: TabName) => void
  dragMainPagerToX: ((x: number) => void) | null
  setDragMainPagerToX: (handler: ((x: number) => void) | null) => void
  animateMainPagerToTab: ((tab: TabName) => void) | null
  setAnimateMainPagerToTab: (handler: ((tab: TabName) => void) | null) => void
}

export const useTabStore = create<TabStore>((set) => ({
  activeTab: 'feed',
  setActiveTab: (activeTab) => set({ activeTab }),
  dragMainPagerToX: null,
  setDragMainPagerToX: (dragMainPagerToX) => set({ dragMainPagerToX }),
  animateMainPagerToTab: null,
  setAnimateMainPagerToTab: (animateMainPagerToTab) => set({ animateMainPagerToTab }),
}))
