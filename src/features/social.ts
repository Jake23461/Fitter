import { QueryClient } from '@tanstack/react-query'
import { Alert } from 'react-native'
import { supabase } from '../lib/supabase'
import type { Profile, SocialCounts, SocialProfileSearchResult, SocialRelationship } from '../types'

export const socialKeys = {
  relationship: (viewerId: string | undefined, targetId: string | undefined) => ['social', 'relationship', viewerId, targetId] as const,
  counts: (userId: string | undefined) => ['social', 'counts', userId] as const,
  search: (viewerId: string | undefined, term: string) => ['social', 'search', viewerId, term] as const,
}

function buildSearchPattern(term: string) {
  return `%${term.replace(/[%*,]/g, '').trim()}%`
}

export async function fetchSocialRelationship(viewerId: string, targetId: string): Promise<SocialRelationship> {
  const [{ data: following }, { data: followedBy }] = await Promise.all([
    supabase
      .from('friendships')
      .select('id')
      .eq('follower_id', viewerId)
      .eq('following_id', targetId)
      .maybeSingle(),
    supabase
      .from('friendships')
      .select('id')
      .eq('follower_id', targetId)
      .eq('following_id', viewerId)
      .maybeSingle(),
  ])

  const isFollowing = !!following
  const isFollowedBy = !!followedBy

  return {
    isFollowing,
    isFollowedBy,
    isFriend: isFollowing && isFollowedBy,
  }
}

export async function fetchSocialCounts(userId: string): Promise<SocialCounts> {
  const [{ count: followerCount }, { count: followingCount }] = await Promise.all([
    supabase
      .from('friendships')
      .select('id', { count: 'exact', head: true })
      .eq('following_id', userId),
    supabase
      .from('friendships')
      .select('id', { count: 'exact', head: true })
      .eq('follower_id', userId),
  ])

  return {
    followerCount: followerCount ?? 0,
    followingCount: followingCount ?? 0,
  }
}

export async function toggleFollow(viewerId: string, targetId: string, isFollowing: boolean) {
  const query = isFollowing
    ? supabase.from('friendships').delete().eq('follower_id', viewerId).eq('following_id', targetId)
    : supabase.from('friendships').insert({ follower_id: viewerId, following_id: targetId })

  const { error } = await query
  if (error && error.code !== '23505') throw error
}

export function getSocialActionLabel(relationship: SocialRelationship) {
  if (relationship.isFriend) return 'FRIENDS'
  if (relationship.isFollowing) return 'FOLLOWING'
  if (relationship.isFollowedBy) return 'FOLLOW BACK'
  return 'FOLLOW'
}

export function invalidateSocialState(queryClient: QueryClient, viewerId: string, targetId: string) {
  queryClient.invalidateQueries({ queryKey: socialKeys.relationship(viewerId, targetId) })
  queryClient.invalidateQueries({ queryKey: socialKeys.relationship(targetId, viewerId) })
  queryClient.invalidateQueries({ queryKey: socialKeys.counts(viewerId) })
  queryClient.invalidateQueries({ queryKey: socialKeys.counts(targetId) })
  queryClient.invalidateQueries({ queryKey: ['profile', viewerId] })
  queryClient.invalidateQueries({ queryKey: ['profile', targetId] })
  queryClient.invalidateQueries({ queryKey: ['notifications', viewerId] })
  queryClient.invalidateQueries({ queryKey: ['notif-unread', viewerId] })
  queryClient.invalidateQueries({ queryKey: ['feed'] })
}

export async function searchProfiles(viewerId: string, term: string): Promise<SocialProfileSearchResult[]> {
  const trimmed = term.trim()
  let query = supabase
    .from('profiles')
    .select('*')
    .neq('id', viewerId)
    .limit(20)

  if (trimmed) {
    const pattern = buildSearchPattern(trimmed)
    query = query.or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
  }

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error

  const profiles = (data ?? []) as Profile[]
  if (profiles.length === 0) return []

  const targetIds = profiles.map((profile) => profile.id)

  const [{ data: followingRows }, { data: followedByRows }] = await Promise.all([
    supabase
      .from('friendships')
      .select('following_id')
      .eq('follower_id', viewerId)
      .in('following_id', targetIds),
    supabase
      .from('friendships')
      .select('follower_id')
      .eq('following_id', viewerId)
      .in('follower_id', targetIds),
  ])

  const followingSet = new Set((followingRows ?? []).map((row) => row.following_id))
  const followedBySet = new Set((followedByRows ?? []).map((row) => row.follower_id))

  return profiles.map((profile) => {
    const isFollowing = followingSet.has(profile.id)
    const isFollowedBy = followedBySet.has(profile.id)

    return {
      ...profile,
      isFollowing,
      isFollowedBy,
      isFriend: isFollowing && isFollowedBy,
    }
  })
}

export function showSocialError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Something went wrong.'
  Alert.alert('Error', message)
}
