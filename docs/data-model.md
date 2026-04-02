# Fitter — Data Model Reference

Source of truth: `supabase/schema.sql`. Schema is live on Supabase.

---

## Table Overview

| Table | Purpose |
|---|---|
| `profiles` | One per user; 1:1 with `auth.users` |
| `gyms` | Gym locations (verified + user-submitted) |
| `gym_sessions` | A user's check-in at a gym |
| `posts` | Photo/video post tied to a session |
| `post_media` | Media files for a post (1 post = 1+ media) |
| `post_likes` | Which users liked which posts |
| `post_comments` | Comments on posts |
| `friendships` | Follow graph (unidirectional) |
| `saved_workouts` | User's saved posts |
| `pr_entries` | Personal records |
| `achievements` | Earned badges/milestones |
| `reports` | Content/user reports |
| `notifications` | In-app notifications |

---

## Table Schemas

### `profiles`
Auto-created on sign-up via Postgres trigger (`handle_new_user`). Username and display_name are seeded from the email prefix.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | — | PK; FK → `auth.users(id)` cascade |
| `username` | `text` | NO | — | Unique; `[a-z0-9_]`, max 30 chars |
| `display_name` | `text` | NO | `''` | Max 60 chars |
| `avatar_url` | `text` | YES | null | Full public URL from storage |
| `bio` | `text` | YES | null | Max 120 chars |
| `home_gym_id` | `uuid` | YES | null | FK → `gyms(id)` (no cascade — gyms rare delete) |
| `streak_current` | `integer` | NO | `0` | Updated by app logic on check-in |
| `streak_longest` | `integer` | NO | `0` | Updated when streak_current exceeds it |
| `total_checkins` | `integer` | NO | `0` | Maintained by `gym_sessions_checkin_count` trigger |
| `is_banned` | `boolean` | NO | `false` | Admin-set; banned users cannot post or log in |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated by `profiles_updated_at` trigger |

---

### `gyms`

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | generated | PK |
| `name` | `text` | NO | — | |
| `address` | `text` | NO | `''` | |
| `lat` | `float8` | NO | `0` | |
| `lng` | `float8` | NO | `0` | |
| `radius_meters` | `integer` | NO | `150` | Check-in radius for location verification |
| `is_verified` | `boolean` | NO | `false` | Admin-verified gyms show in verified list |
| `submitted_by` | `uuid` | YES | null | FK → `profiles(id)` set null on delete |
| `created_at` | `timestamptz` | NO | `now()` | |

---

### `gym_sessions`

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | generated | PK |
| `user_id` | `uuid` | NO | — | FK → `profiles(id)` cascade |
| `gym_id` | `uuid` | NO | — | FK → `gyms(id)` cascade |
| `location_verified` | `boolean` | NO | `false` | True if GPS was within `gym.radius_meters` |
| `checked_in_at` | `timestamptz` | NO | `now()` | Exact check-in timestamp |
| `checked_out_at` | `timestamptz` | YES | null | Null = still active |
| `session_date` | `date` | NO | `current_date` | Calendar day; used for streak and feed queries |
| `created_at` | `timestamptz` | NO | `now()` | |

**Key constraint:** Unique partial index on `(user_id) where checked_out_at is null` — only one active session per user at a time.

**`session_date` vs `checked_in_at`:** Always use `session_date` for "did user check in today?" queries. `checked_in_at` is for display only.

---

### `posts`

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | generated | PK |
| `user_id` | `uuid` | NO | — | FK → `profiles(id)` cascade |
| `session_id` | `uuid` | NO | — | FK → `gym_sessions(id)` cascade |
| `gym_id` | `uuid` | NO | — | FK → `gyms(id)` cascade (denorm for fast feed queries) |
| `caption` | `text` | YES | null | Max 280 chars |
| `like_count` | `integer` | NO | `0` | Maintained by `post_likes_count` trigger — **read only** from app |
| `comment_count` | `integer` | NO | `0` | Maintained by `post_comments_count` trigger — **read only** from app |
| `is_deleted` | `boolean` | NO | `false` | Soft delete — never hard delete posts |
| `post_date` | `date` | NO | `current_date` | Used for feed queries |
| `created_at` | `timestamptz` | NO | `now()` | |

**Soft delete:** Set `is_deleted = true`. RLS policy only exposes rows where `is_deleted = false`.

---

### `post_media`

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | generated | PK |
| `post_id` | `uuid` | NO | — | FK → `posts(id)` cascade |
| `media_type` | `text` | NO | — | `'photo'` or `'video'` |
| `storage_path` | `text` | NO | — | Path within bucket, e.g. `{userId}/{postId}.jpg` |
| `width` | `integer` | YES | null | Original pixel width |
| `height` | `integer` | YES | null | Original pixel height |
| `duration_seconds` | `float4` | YES | null | Video only; max 30s |
| `created_at` | `timestamptz` | NO | `now()` | |

**Storage bucket:** `post-media` (public read). Construct URL via `supabase.storage.from('post-media').getPublicUrl(storage_path)`.

---

### `post_likes`

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | `uuid` | NO | PK |
| `post_id` | `uuid` | NO | FK → `posts(id)` cascade |
| `user_id` | `uuid` | NO | FK → `profiles(id)` cascade |
| `created_at` | `timestamptz` | NO | |

**Unique:** `(post_id, user_id)` — one like per user per post.

---

### `post_comments`

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | `uuid` | NO | PK |
| `post_id` | `uuid` | NO | FK → `posts(id)` cascade |
| `user_id` | `uuid` | NO | FK → `profiles(id)` cascade |
| `body` | `text` | NO | Max 500 chars |
| `is_deleted` | `boolean` | NO | Soft delete |
| `created_at` | `timestamptz` | NO | |

---

### `friendships`

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | `uuid` | NO | PK |
| `follower_id` | `uuid` | NO | The user who followed |
| `following_id` | `uuid` | NO | The user being followed |
| `created_at` | `timestamptz` | NO | |

**Unique:** `(follower_id, following_id)`. Self-follow prevented by check constraint. Unidirectional — A follows B doesn't mean B follows A.

---

### `saved_workouts`

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | `uuid` | NO | PK |
| `user_id` | `uuid` | NO | FK → `profiles(id)` cascade |
| `post_id` | `uuid` | NO | FK → `posts(id)` cascade |
| `created_at` | `timestamptz` | NO | |

**Unique:** `(user_id, post_id)`. Private — RLS only exposes owner's rows.

---

### `pr_entries`

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | `uuid` | NO | PK |
| `user_id` | `uuid` | NO | FK → `profiles(id)` cascade |
| `exercise_name` | `text` | NO | Free text, e.g. "Bench Press" |
| `weight_kg` | `float4` | NO | |
| `reps` | `integer` | NO | |
| `notes` | `text` | YES | Max 200 chars |
| `logged_at` | `date` | NO | `current_date` |
| `created_at` | `timestamptz` | NO | |

**Private** — RLS only exposes owner's rows.

---

### `achievements`

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | `uuid` | NO | PK |
| `user_id` | `uuid` | NO | FK → `profiles(id)` cascade |
| `achievement_key` | `text` | NO | e.g. `'streak_7'`, `'first_post'` |
| `earned_at` | `timestamptz` | NO | |

**Unique:** `(user_id, achievement_key)`. Inserted by service role / edge function only.

---

### `reports`

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | `uuid` | NO | PK |
| `reporter_id` | `uuid` | NO | FK → `profiles(id)` cascade |
| `post_id` | `uuid` | YES | FK → `posts(id)` set null on delete |
| `reported_user_id` | `uuid` | YES | FK → `profiles(id)` set null on delete |
| `reason` | `text` | NO | `'spam'`, `'nudity'`, `'harassment'`, `'fake_checkin'`, `'other'` |
| `notes` | `text` | YES | Max 500 chars |
| `status` | `text` | NO | `'pending'` → `'reviewed'` → `'actioned'` or `'dismissed'` |
| `reviewed_by` | `uuid` | YES | Admin profile ID |
| `reviewed_at` | `timestamptz` | YES | |
| `created_at` | `timestamptz` | NO | |

**Constraint:** At least one of `post_id` or `reported_user_id` must be non-null. RLS: users can insert, only admins can select.

---

### `notifications`

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | `uuid` | NO | PK |
| `user_id` | `uuid` | NO | Recipient; FK → `profiles(id)` cascade |
| `type` | `text` | NO | `'like'`, `'comment'`, `'follow'`, `'achievement'` |
| `actor_id` | `uuid` | YES | Who triggered it; null for system notifications |
| `post_id` | `uuid` | YES | Relevant post; null for follows/achievements; cascades on post delete |
| `body` | `text` | NO | Pre-rendered text, e.g. "Jake liked your post" |
| `is_read` | `boolean` | NO | `false` |
| `created_at` | `timestamptz` | NO | |

**Inserted by service role / edge function only.** RLS: owner can select and update (mark read).

---

## Triggers Summary

| Trigger | Table | Effect |
|---|---|---|
| `on_auth_user_created` | `auth.users` INSERT | Creates `profiles` row with temp username |
| `profiles_updated_at` | `profiles` UPDATE | Sets `updated_at = now()` |
| `post_likes_count` | `post_likes` INSERT/DELETE | Increments/decrements `posts.like_count` |
| `post_comments_count` | `post_comments` INSERT/UPDATE | Increments on insert; decrements on soft-delete |
| `gym_sessions_checkin_count` | `gym_sessions` INSERT | Increments `profiles.total_checkins` |

**Never manually update `like_count`, `comment_count`, or `total_checkins`** — triggers own these.

---

## Storage Buckets

| Bucket | Public | Write rule |
|---|---|---|
| `avatars` | Yes | Authenticated; path must start with `{userId}/` |
| `post-media` | Yes | Authenticated; path must start with `{userId}/` |
| `gym-assets` | Yes | Service role only |

**Path convention:**
- Avatar: `{userId}/avatar.jpg` (overwrite on update)
- Post media: `{userId}/{postId}.jpg` or `{userId}/{postId}.mp4`

---

## RLS Quick Reference

| Table | Public read? | Who can write? |
|---|---|---|
| `profiles` | Yes (all) | Owner (update only) |
| `gyms` | Yes | Any auth user (insert) |
| `gym_sessions` | Yes | Owner (insert + update own) |
| `posts` | Yes (non-deleted) | Owner (insert + soft-delete) |
| `post_media` | Yes | Owner of parent post |
| `post_likes` | Yes | Auth user (insert own; delete own) |
| `post_comments` | Yes (non-deleted) | Auth user (insert); owner (soft-delete) |
| `friendships` | Yes | Auth user (insert/delete own as follower) |
| `saved_workouts` | Owner only | Owner |
| `pr_entries` | Owner only | Owner |
| `achievements` | Owner only | Service role |
| `reports` | No (admin only) | Auth user (insert) |
| `notifications` | Owner only | Service role (insert); owner (update is_read) |
