# Fitter — Product

## Vision

Fitter is a social fitness app built around the gym check-in. The core idea: being at the gym is the gate for everything. You can only post when you're actually there, which makes every post real, and makes showing up mean something. It's built for people who already go to the gym and want a place where that effort is visible and shared with people who get it.

**Target user:** Regular gym-goers (3–5x/week), ages 18–35, who feel like fitness content on existing platforms is either too polished, too aspirational, or drowned out by people who don't actually train.

---

## Core Loop

```
Check in at gym → Post photo or video(one a day) → Friends interact → Come back tomorrow , inspired by BeReal
```

Every feature either supports this loop or is cut. A streak is only meaningful if it's earned at the gym. A post is only authentic if it required a check-in to create.

---

## Design Principles

### 1. Sessions gate everything
You cannot post without an active gym session. This is the app's defining constraint. It's not a UX decision — it's the product. Never design a flow that lets users post without being checked in.

### 2. Streaks are sacred
The streak is the primary retention mechanic. Streak logic must be accurate to the day. If the streak breaks when it shouldn't, or doesn't break when it should, users will lose trust in the app entirely. Always use `session_date` (a calendar date) for streak calculations, not timestamps.

### 3. Earned not curated
Content is shown from people you follow + people at your gym today. No algorithmic amplification, no viral mechanics. Follower feeds and gym-local feeds only. This means the feed is always relevant and always honest.

### 4. Simplicity over features
The MVP does one thing well: check in, post, connect. No workout logging beyond PRs. No DMs. No discover tab. No stories. If a feature doesn't support the core loop in an obvious way, it's out of scope.

### 5. Direct UI copy
All in-app text should be short, direct, and conversational. No corporate-speak. No gamification jargon ("You've unlocked a badge!"). Just clear, human language. Examples:
- "Start your streak today." ✓ vs "Begin your fitness journey!" ✗
- "Check out" ✓ vs "End session" ✗
- "No posts yet" ✓ vs "This user hasn't shared any content yet" ✗

---

## Settled Decisions

These are choices that have been made and should not be revisited without strong reason.

**Location verification is optional, not mandatory**
Users can check in at their home gym without GPS verification. This supports indoor gyms where GPS is unreliable, and prevents false negatives that would break the core loop. Verified sessions are marked `location_verified = true` and may surface differently in UI eventually, but are not required to post.

**30-second video cap**
Keeps media sizes manageable, encourages concise content (no tutorials, no long vlogs), and matches the platform's vibe — quick glimpses of a session, not full workouts.

**Soft delete on posts and comments**
Set `is_deleted = true` rather than hard deleting. This preserves referential integrity for reports and audit trails. The RLS policy filters deleted content automatically.

**No DMs at launch**
Messaging is a separate product problem. It adds complexity (moderation, storage, realtime), creates a new abuse vector, and isn't part of the core loop. Post comments are the connection mechanism for MVP.

**`username` is lowercase alphanumeric + underscore only**
Enforced by DB constraint (`^[a-z0-9_]+$`). Avoids homograph attacks, makes usernames predictable for deep links, and keeps the profile URL simple.

**`post_date` and `session_date` are calendar dates, not timestamps**
Feed queries filter by `post_date = today`. Streak queries check `session_date = yesterday`. Always use these date columns for day-based logic — never truncate timestamps, as timezone issues can cause off-by-one errors.

**Like/comment counts are denormalized on `posts`**
`posts.like_count` and `posts.comment_count` are maintained by DB triggers. The app never calculates these — it reads the stored values. Never write to these columns from the app.

**Follow graph is unidirectional**
Following A does not mean A follows you back. No "mutual follow" concept at MVP. `friendships.follower_id` → `friendships.following_id`.

---

## What's Out of Scope for MVP

- Direct messages
- Gym discovery / map view
- Full workout logging (exercises, sets, reps) — PRs only
- Leaderboards / rankings
- Stories / ephemeral content
- Paid features / subscriptions
- Web app
- Workout plans / programming
