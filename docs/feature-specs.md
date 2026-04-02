# Fitter — Feature Specs

Screen-by-screen implementation guide. For each screen: what it fetches, what actions it handles, and how edge cases/states are handled.

---

## Auth Flow

### `(auth)/welcome`
Entry point for unauthenticated users.

**Actions:**
- "Create account" → `/(auth)/sign-up`
- "Sign in" → `/(auth)/sign-in`

**No data fetching.** Static screen.

---

### `(auth)/sign-up`
Email + password registration.

**Actions:**
- Submit: `supabase.auth.signUp({ email, password })`
- On success: show alert ("Check your inbox"), redirect to `/(auth)/sign-in`
- On error: show `Alert.alert('Error', error.message)`

**Validation:**
- Email: non-empty
- Password: min 8 characters

**After sign-up:** Supabase trigger auto-creates a `profiles` row with a temp username. The user must then complete `/(auth)/setup-profile`.

**Note:** If email confirmation is disabled in Supabase (for dev), `signUp` returns a session immediately. Auth listener in `_layout.tsx` will redirect to `/(tabs)/feed`, which should detect an incomplete profile (no `display_name` set by user) and redirect to `/(auth)/setup-profile`.

---

### `(auth)/sign-in`
Email + password login.

**Actions:**
- Submit: `supabase.auth.signInWithPassword({ email, password })`
- On success: auth listener in `_layout.tsx` handles redirect to `/(tabs)/feed`
- On error: show `Alert.alert('Error', error.message)`
- "Forgot password?" link → trigger `supabase.auth.resetPasswordForEmail(email)`

---

### `(auth)/setup-profile`
Shown after sign-up (or when `profile.display_name` is still the seeded email prefix).

**Actions:**
- Set display name (required), username (required, must pass format check), optional bio and avatar
- Avatar: image picker → upload to `avatars/{userId}/avatar.jpg` → set `avatar_url` to public URL
- Submit: `supabase.from('profiles').update({ display_name, username, bio, avatar_url }).eq('id', userId)`
- On success: redirect to `/(tabs)/feed`

**Validation:**
- `display_name`: non-empty, max 60 chars
- `username`: lowercase `[a-z0-9_]`, max 30 chars, must not already be taken (check before submitting)
- `bio`: max 120 chars

**Username uniqueness check:**
```ts
const { data } = await supabase.from('profiles').select('id').eq('username', value).maybeSingle()
if (data) setError('Username already taken')
```

---

## Tab Screens

### `(tabs)/feed`
Main content feed. Two tabs: **For You** and **Gym**.

**State:**
- Active tab (For You | Gym)
- Page data from `useInfiniteQuery`

**For You feed query:**
- Posts from users the current user follows + posts from people at the same gym today
- Filter: `post_date = today`, `is_deleted = false` (RLS handles this)
- Order: `created_at desc`
- Include: `profile:profiles(*)`, `gym:gyms(*)`, `post_media(*)`
- Paginate: 10 per page

**Gym feed query:**
- All posts at `profile.home_gym_id` today
- Same shape as For You

**Empty states:**
- For You (no follows, no gym): "Follow some people or set a home gym to see posts here."
- Gym (no gym set): "Set a home gym in your profile to see who's training there."
- Gym (has gym, no posts today): "No one has posted from [Gym Name] today. Be the first."

**Loading:** Skeleton cards (grey placeholder blocks matching PostCard dimensions) for first load.

**Pull to refresh:** `useInfiniteQuery` `refetch()`.

**Tap post:** Navigate to `post/[id]`.

**PostCard shows:** Avatar + username, gym name, time ago, media (photo/video), caption, like count, comment count, like button, comment button.

---

### `(tabs)/checkin`
The gym check-in screen. Two states: **no active session** and **active session**.

#### No active session
**On mount:** Request location permission. If denied, show message explaining why it's needed, with option to check in at home gym without verification.

**Flow:**
1. Get current GPS coordinates (`expo-location`)
2. Query `gyms` table — find gyms where the user's location is within `radius_meters`
   ```ts
   // Client-side distance filter (no PostGIS needed for MVP)
   // Fetch all verified gyms + user's home gym, filter by distance in JS
   function distanceMeters(lat1, lng1, lat2, lng2): number { /* haversine */ }
   ```
3. Show list of matching gyms (verified gyms first, then home gym if within range)
4. If no gym in range: show "No gyms found nearby" + option to check in at home gym without GPS

**Check-in action:**
```ts
supabase.from('gym_sessions').insert({
  user_id,
  gym_id,
  location_verified: gpsMatched,
  session_date: today,
})
```
Then: call `updateStreak(userId, today)` (see supabase-patterns.md), refresh `activeSession` in `sessionStore`.

#### Active session
Shows:
- Gym name + check-in time ("Checked in 43 min ago")
- Location verified badge (if applicable)
- **Create Post** button → `/(create-post)` modal
- **Check Out** button → `sessionStore.checkOut()`

**Auto-close:** Sessions older than 4 hours should be shown as expired ("Your session expired — check in again") and treated as inactive.

---

### `(tabs)/notifications`
List of in-app notifications for the current user.

**Query:**
```ts
supabase.from('notifications')
  .select('*, actor:profiles!actor_id(id, username, display_name, avatar_url)')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(50)
```

**On mount:** Mark all as read after a short delay (500ms) or on screen blur.

**Unread badge:** Shown on tab icon. Count unread notifications. Refresh when screen focuses.

**Notification types:**
- `like`: "[username] liked your post" → tap → `post/[id]`
- `comment`: "[username] commented: [preview]" → tap → `post/[id]`
- `follow`: "[username] started following you" → tap → `profile/[id]`
- `achievement`: "[body text]" → no navigation

**Empty state:** "No notifications yet."

---

### `(tabs)/profile`
The current user's own profile.

**Data:**
- `useAuthStore().profile` (already loaded globally)
- Posts: query `posts` where `user_id = userId`, order by `created_at desc`
- Three tabs: **Posts** (grid), **Saved** (grid), **PRs** (list)

**Header:**
- Avatar, display name, username, bio
- Stats: streak (🔥 N), total check-ins, followers count, following count
- "Edit Profile" button → push to `/(auth)/setup-profile` (reused for editing)
- Settings icon → (settings screen, not in MVP but placeholder)

**Posts tab:** 3-column photo grid. Tap → `post/[id]`.

**Saved tab:** Same grid layout, queries `saved_workouts` joined with `posts`.
```ts
supabase.from('saved_workouts')
  .select('post:posts(*, post_media(*))')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
```

**PRs tab:** List of `pr_entries` grouped by `exercise_name`, showing most recent PR per exercise. Tap to expand history. Swipe to delete.

**Empty states:**
- No posts: "No posts yet. Check in and share your first workout."
- No saved: "Save posts from your feed to see them here."
- No PRs: "Log a PR to track your progress." + "Log PR" button → `log-pr` modal

---

## Modal Screens

### `create-post`
Only accessible during an active gym session. If no active session, dismiss with error.

**Flow:**
1. Media picker: camera or photo library (`expo-image-picker`)
   - Photos: max 1 file
   - Videos: max 30 seconds (`mediaTypes: 'Videos'`, check duration)
2. Preview selected media
3. Optional caption (max 280 chars, character counter)
4. Submit:
   - Upload media to `post-media/{userId}/{tempId}.jpg` (or `.mp4`)
   - Create `posts` row: `{ user_id, session_id: activeSession.id, gym_id: activeSession.gym_id, caption }`
   - Create `post_media` row: `{ post_id, media_type, storage_path, width, height, duration_seconds }`
5. On success: dismiss modal, invalidate feed queries
6. On failure: show retry option — do not lose the selected media

**Upload progress:** Show a progress bar using `supabase.storage.from().upload()` with `onUploadProgress`.

**Loading state:** Disable submit button during upload, show spinner.

---

### `post/[id]`
Full post detail screen.

**Data:**
- Post with profile, gym, post_media
- Comments: `post_comments` with `profile:profiles(*)`, ordered `created_at asc`
- Whether current user has liked / saved

**Actions:**
- Like / unlike
- Save / unsave
- Add comment (text input pinned at bottom, `KeyboardAvoidingView`)
- Delete own comment (long press or swipe)
- Delete own post (via `...` menu → sets `is_deleted = true`)
- Report post (via `...` menu → 5 reason options → `reports` insert)
- Tap avatar/username → `profile/[id]`

**Media display:** Full-width. Photos: `Image` with aspect ratio from `width/height`. Videos: `expo-av` Video component, auto-play muted, tap to unmute.

---

### `profile/[id]`
Another user's profile (not the current user).

**Data:** Same as own profile but query by `id` param. No edit button. No saved or PR tabs (private). Just Posts grid.

**Actions:**
- Follow / unfollow: insert/delete `friendships` row
- Block user: insert `reports` row with `reason: 'harassment'` + local hide (store blocked user ID in local state until proper block table is added)
- Report user: `reports` insert with `reported_user_id`

**Follower/following counts:**
```ts
supabase.from('friendships').select('id', { count: 'exact', head: true }).eq('following_id', userId)
supabase.from('friendships').select('id', { count: 'exact', head: true }).eq('follower_id', userId)
```

**"Is following" check:**
```ts
supabase.from('friendships')
  .select('id').eq('follower_id', currentUserId).eq('following_id', profileUserId).maybeSingle()
```

---

### `log-pr`
Simple form to log a personal record.

**Fields:**
- Exercise name (text input, e.g. "Bench Press")
- Weight (numeric, kg)
- Reps (numeric)
- Date (date picker, defaults to today)
- Notes (optional, max 200 chars)

**Submit:** `supabase.from('pr_entries').insert(...)`, then invalidate `['pr-entries', userId]`, dismiss modal.

**No session required** — PRs can be logged any time.

---

### `add-gym`
Submit a new unverified gym (user's home gym or any gym not in the database).

**Fields:**
- Gym name (required)
- Address (optional but encouraged)
- Location: use current GPS or let user skip

**Submit:** `supabase.from('gyms').insert({ name, address, lat, lng, submitted_by: userId })` — `is_verified` defaults to `false`.

After insert: update `profiles.home_gym_id` to the new gym's ID if this is the user's home gym.

---

## Error & Empty State Summary

| Screen | Empty state message |
|---|---|
| For You feed (no follows) | "Follow people to see their posts here." |
| For You feed (no posts today) | "No one you follow has posted today." |
| Gym feed (no home gym) | "Set a home gym in your profile." |
| Gym feed (no posts today) | "No posts from [Gym] today. Be first." |
| Own profile (no posts) | "Check in and share your first workout." |
| Own profile (no saved) | "Save posts from your feed." |
| Own profile (no PRs) | "Log a PR to track your progress." |
| Other profile (no posts) | "No posts yet." |
| Notifications (empty) | "No notifications yet." |
| Check-in (no gyms nearby) | "No gyms found nearby." |

**Loading states:** All lists and grids show skeleton placeholders on first load. Subsequent loads (pagination, pull-to-refresh) show a subtle spinner.

**Network errors:** All screens catch Supabase errors and show `Alert.alert('Error', error.message)`. Network timeout / offline state is handled with a top-of-screen banner (future: `NetInfo`).
