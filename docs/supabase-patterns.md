# Fitter — Supabase Patterns

Common patterns used throughout the app. Follow these exactly to stay consistent and avoid RLS/query mistakes.

---

## Client Import

```ts
import { supabase } from '../src/lib/supabase'     // from app/ screens
import { supabase } from '../../src/lib/supabase'  // from nested app/ screens (e.g. app/(auth)/)
import { supabase } from '../lib/supabase'          // from src/hooks/ or src/stores/
```

Always use the anon client. Never use the service role key on the client.

---

## Error Handling

Always destructure `{ data, error }` and check `error` before using `data`.

```ts
const { data, error } = await supabase.from('posts').select('*').eq('id', id).single()
if (error) {
  Alert.alert('Error', error.message)
  return
}
// data is safe to use here
```

For mutations in React Query:
```ts
useMutation({
  mutationFn: async () => {
    const { error } = await supabase.from('post_likes').insert({ post_id, user_id })
    if (error) throw error
  },
  onError: (err) => Alert.alert('Error', err.message),
})
```

---

## Selecting Related Data (Joins)

Supabase uses PostgREST syntax for joins. Use aliased foreign keys for clarity.

```ts
// Full post with all related data
supabase
  .from('posts')
  .select(`
    *,
    profile:profiles(*),
    gym:gyms(*),
    post_media(*)
  `)
  .eq('id', postId)
  .single()

// Session with gym
supabase
  .from('gym_sessions')
  .select('*, gym:gyms(*)')
  .eq('user_id', userId)
  .is('checked_out_at', null)
  .maybeSingle()
```

---

## `single()` vs `maybeSingle()`

- `single()` — use when you expect exactly one row. Throws an error if 0 or 2+ rows returned.
- `maybeSingle()` — use when the row may or may not exist. Returns `null` (not an error) if not found.

```ts
// Profile must exist if user is logged in
.single()

// Active session may not exist
.maybeSingle()
```

---

## Checking `user_has_liked` and `user_has_saved`

These aren't columns — compute them with a separate query or use a subquery. The simplest approach is two queries in parallel:

```ts
const [{ data: post }, { data: liked }, { data: saved }] = await Promise.all([
  supabase.from('posts').select('*, profile:profiles(*), post_media(*), gym:gyms(*)').eq('id', postId).single(),
  supabase.from('post_likes').select('id').eq('post_id', postId).eq('user_id', userId).maybeSingle(),
  supabase.from('saved_workouts').select('id').eq('post_id', postId).eq('user_id', userId).maybeSingle(),
])

const enrichedPost = { ...post, user_has_liked: !!liked, user_has_saved: !!saved }
```

---

## Feed Queries

### For You feed (followed users + gym peers today)
```ts
// Step 1: get list of followed user IDs
const { data: follows } = await supabase
  .from('friendships')
  .select('following_id')
  .eq('follower_id', userId)

const followedIds = follows?.map(f => f.following_id) ?? []

// Step 2: get user's active or recent gym session's gym_id
// (or use profile.home_gym_id as fallback)

// Step 3: query posts
supabase
  .from('posts')
  .select('*, profile:profiles(*), gym:gyms(*), post_media(*)')
  .or(`user_id.in.(${followedIds.join(',')}),gym_id.eq.${gymId}`)
  .eq('post_date', today)  // today = new Date().toISOString().split('T')[0]
  .order('created_at', { ascending: false })
  .range(from, to)
```

### Gym feed (all posts at home gym today)
```ts
supabase
  .from('posts')
  .select('*, profile:profiles(*), gym:gyms(*), post_media(*)')
  .eq('gym_id', homeGymId)
  .eq('post_date', today)
  .order('created_at', { ascending: false })
  .range(from, to)
```

---

## Pagination (Infinite Scroll)

Use `.range(from, to)` with page size of 10.

```ts
const PAGE_SIZE = 10
const from = page * PAGE_SIZE
const to = from + PAGE_SIZE - 1

supabase.from('posts').select('*').range(from, to)
```

With React Query's `useInfiniteQuery`:
```ts
useInfiniteQuery({
  queryKey: ['feed', 'for-you'],
  queryFn: ({ pageParam = 0 }) => fetchFeedPage(pageParam),
  getNextPageParam: (lastPage, pages) =>
    lastPage.length < PAGE_SIZE ? undefined : pages.length,
})
```

---

## Storage — Uploading Files

```ts
import * as FileSystem from 'expo-file-system'
import { decode } from 'base64-arraybuffer'  // install: npx expo install base64-arraybuffer

// Read file as base64
const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' })

// Upload to storage
const { error } = await supabase.storage
  .from('post-media')
  .upload(`${userId}/${postId}.jpg`, decode(base64), {
    contentType: 'image/jpeg',
    upsert: false,
  })
```

---

## Storage — Getting Public URLs

```ts
const { data } = supabase.storage
  .from('post-media')
  .getPublicUrl(storagePath)

const url = data.publicUrl
// e.g. https://xxxcklhdsbawtwltcyea.supabase.co/storage/v1/object/public/post-media/{userId}/{postId}.jpg
```

Note: `getPublicUrl` is synchronous (no `await`) — it just constructs the URL.

---

## Storage — Image Transformations (thumbnails)

Use Supabase image transformations to serve smaller thumbnails in the feed:
```ts
const { data } = supabase.storage
  .from('post-media')
  .getPublicUrl(storagePath, {
    transform: { width: 600, quality: 80 },
  })
```

Only works for images (`photo` type), not videos.

---

## Storage Path Conventions

| Bucket | Path pattern | Example |
|---|---|---|
| `avatars` | `{userId}/avatar.jpg` | `abc123/avatar.jpg` |
| `post-media` | `{userId}/{postId}.jpg` or `.mp4` | `abc123/def456.jpg` |

Always prefix with `userId` — storage RLS enforces this.

---

## Auth

```ts
// Get current user (sync, from session)
const { data: { session } } = await supabase.auth.getSession()
const userId = session?.user?.id

// Sign up
const { error } = await supabase.auth.signUp({ email, password })

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({ email, password })

// Sign out
await supabase.auth.signOut()

// Password reset
const { error } = await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: 'fitter://reset-password',  // deep link — configure in app.json
})
```

---

## Streak Logic

Streaks are managed in app code (not a trigger). After a successful check-in:

```ts
async function updateStreak(userId: string, sessionDate: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('streak_current, streak_longest')
    .eq('id', userId)
    .single()

  // Check if yesterday had a session
  const yesterday = new Date(sessionDate)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  const { data: yesterdaySession } = await supabase
    .from('gym_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('session_date', yesterdayStr)
    .maybeSingle()

  const newStreak = yesterdaySession ? profile.streak_current + 1 : 1
  const newLongest = Math.max(newStreak, profile.streak_longest)

  await supabase
    .from('profiles')
    .update({ streak_current: newStreak, streak_longest: newLongest })
    .eq('id', userId)
}
```

Streak reset (missed day) is handled here — if no yesterday session, streak resets to 1.

---

## Notifications

Notifications are inserted by server-side logic (edge functions or triggers). The client only reads and marks as read.

```ts
// Fetch notifications
supabase
  .from('notifications')
  .select('*, actor:profiles!actor_id(*)')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(50)

// Mark all read
supabase
  .from('notifications')
  .update({ is_read: true })
  .eq('user_id', userId)
  .eq('is_read', false)

// Unread count
supabase
  .from('notifications')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', userId)
  .eq('is_read', false)
```

---

## Reporting

```ts
// Report a post
supabase.from('reports').insert({
  reporter_id: userId,
  post_id: postId,
  reason: 'spam',  // 'spam' | 'nudity' | 'harassment' | 'fake_checkin' | 'other'
})

// Report a user
supabase.from('reports').insert({
  reporter_id: userId,
  reported_user_id: targetUserId,
  reason: 'harassment',
})
```

---

## React Query Key Conventions

Use consistent query keys so invalidation works across screens.

```ts
['post', postId]                    // single post
['posts', 'feed', 'for-you']        // For You feed pages
['posts', 'feed', 'gym', gymId]     // Gym feed pages
['posts', 'user', userId]           // user's posts on profile
['comments', postId]                // comments for a post
['profile', userId]                 // any profile
['notifications', userId]           // notification list
['pr-entries', userId]              // user's PRs
['saved', userId]                   // user's saved posts
['followers', userId]               // user's followers
['following', userId]               // who user follows
```

After a mutation, invalidate the relevant key:
```ts
queryClient.invalidateQueries({ queryKey: ['post', postId] })
```
