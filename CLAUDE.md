# Fitter — CLAUDE.md

## Project Overview
Fitter is a React Native (Expo) social fitness app. Users check in at gyms, post photos/videos during sessions, follow each other, track streaks, and log PRs. Think Instagram for gym-goers.

## Tech Stack
- **Framework:** Expo ~55, React Native 0.83.2, React 19
- **Routing:** Expo Router (file-based, `app/` directory)
- **Backend:** Supabase (auth, database, storage, edge functions)
- **State:** Zustand (global: auth, active gym session)
- **Data fetching:** TanStack React Query
- **Language:** TypeScript

## Project Structure
```
Fitter/
├── CLAUDE.md                      # You are here
├── docs/
│   ├── product.md                 # Vision, design principles, settled decisions
│   ├── data-model.md              # Schema reference: tables, columns, triggers, RLS
│   ├── supabase-patterns.md       # Query patterns, storage, auth, React Query keys
│   └── feature-specs.md           # Screen-by-screen implementation guide
├── mobile/                        # The app
│   ├── app/                       # Expo Router screens
│   │   ├── _layout.tsx            # Root layout — auth listener, QueryClientProvider
│   │   ├── index.tsx              # Entry redirect (auth check)
│   │   ├── (auth)/                # Unauthenticated screens
│   │   │   ├── welcome.tsx
│   │   │   ├── sign-in.tsx
│   │   │   ├── sign-up.tsx
│   │   │   └── setup-profile.tsx
│   │   ├── (tabs)/                # Main tab screens
│   │   │   ├── feed.tsx
│   │   │   ├── checkin.tsx
│   │   │   ├── notifications.tsx
│   │   │   └── profile.tsx
│   │   ├── post/[id].tsx          # Post detail (modal card)
│   │   ├── profile/[id].tsx       # Other user profile
│   │   ├── create-post.tsx        # Media upload modal
│   │   ├── log-pr.tsx             # PR logging modal
│   │   └── add-gym.tsx            # Add gym modal
│   ├── src/
│   │   ├── lib/supabase.ts        # Supabase client (AsyncStorage session)
│   │   ├── stores/
│   │   │   ├── authStore.ts       # session, profile, fetchProfile, signOut
│   │   │   └── sessionStore.ts    # activeSession, checkOut, fetchActiveSession
│   │   ├── types/index.ts         # All shared TS types
│   │   ├── components/            # Shared UI components (PostCard, etc.)
│   │   └── hooks/
│   │       └── README.md          # Hook catalogue — update as hooks are added
│   ├── supabase/schema.sql        # Full DB schema (already applied)
│   ├── .env                       # EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY (gitignored)
│   └── package.json
└── launch-checklist.md            # MVP gate — check before starting any task
```

## Database (Supabase — already applied)
13 tables: `profiles`, `gyms`, `gym_sessions`, `posts`, `post_media`, `post_likes`, `post_comments`, `friendships`, `saved_workouts`, `pr_entries`, `reports`, `notifications`, `achievements`

Key behaviours:
- `profiles` row auto-created on sign-up via Postgres trigger
- `like_count` / `comment_count` / `total_checkins` maintained by DB triggers
- One active session per user enforced by unique partial index
- Sessions auto-close after 4 hours (cron or trigger)
- RLS enabled on all tables — always use the anon client for user-scoped queries

## Supabase Client
```ts
import { supabase } from '../src/lib/supabase'  // from mobile/
import { supabase } from '../../src/lib/supabase' // from app/ screens
```

## Design System
- **Background:** `#000` (pure black)
- **Surface:** `#111` (cards, inputs)
- **Accent / primary:** `#E5183A` (red — buttons, active states, icons)
- **Text primary:** `#fff`
- **Text secondary:** `#888`
- **Text muted / labels:** `#555`
- **Border / inactive:** `#333` or `#48484A`
- **Border radius:** 14–16pt for inputs/cards, 50% for avatars
- **Typography:** System font, heavy weights (800) for headings, 700 for buttons
- All screens have `backgroundColor: '#000'`, no light mode

## Navigation Conventions
- Expo Router file-based — screen name = file path
- Auth guard is in `app/index.tsx` (redirects based on `useAuthStore().session`)
- Modals use `presentation: 'modal'` or `'card'` in `_layout.tsx`
- Use `router.push()` for navigation, `router.back()` to dismiss modals
- Tab screens never use headers (`headerShown: false`)

## State Management
- **Auth + profile:** `useAuthStore()` — session, profile, loading, fetchProfile, signOut
- **Active gym session:** `useSessionStore()` — activeSession, fetchActiveSession, checkOut
- **Server data:** React Query (`useQuery`, `useMutation`) — don't duplicate in Zustand

## Key Patterns
- Screens fetch their own data with `useQuery`; mutations use `useMutation` + `queryClient.invalidateQueries`
- Supabase queries are inline in hooks/screens, not abstracted into a service layer
- TypeScript types live in `src/types/index.ts` — add new types there, don't define inline
- `Alert.alert()` for errors (native), not custom toast components
- `KeyboardAvoidingView` + `ScrollView` pattern for forms (see sign-up.tsx)

## Running the App
```bash
cd mobile
npx expo start          # starts dev server
npx expo start --ios    # iOS simulator
npx expo start --android
```
Requires `.env` with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

## What's In Scope (MVP)
See `launch-checklist.md` for the full gate. Core loop:
1. Sign up → profile setup
2. Check in at gym (location-verified)
3. Create a photo/video post
4. Feed (For You + Gym tabs)
5. Like, comment, follow
6. Streaks + PR tracking
7. Report + block (safety)
8. Push notifications

## What's Out of Scope for MVP
- DMs / messaging
- Gym discovery map
- Workout logging beyond PRs
- Leaderboards
- Paid features / subscriptions

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Fitter**

Fitter is a React Native (Expo) social fitness app where gym-goers check in at gyms, post photos/videos during sessions, follow each other, track streaks, and log PRs. The app is currently functional but has rough developer-quality UI — the goal of this milestone is a complete frontend overhaul to make it look and feel premium, combined with wiring up all the missing features to reach a shippable MVP.

**Core Value:** The feed must look stunning — media-forward, dark glass aesthetic — because that's what makes users share and come back.

### Constraints

- **Tech Stack:** Expo ~55, React Native 0.83.2, React 19 — do not upgrade during this milestone
- **No new backend tables:** All required DB schema already exists; work within current schema
- **React Native styling only:** No web-specific CSS; use StyleSheet + react-native-reanimated for animations
- **Expo SDK packages only:** For new animation/haptic/image libs, use Expo-compatible versions
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript ~5.9.2 - All app code, screens, hooks, stores, types
- JavaScript (Node.js) - Build system, scripts
- SQL - Supabase database schema, triggers, RLS policies (`mobile/supabase/schema.sql`)
## Runtime
- React Native 0.83.2 - Mobile application framework
- Expo ~55.0.8 - React Native toolchain, development server, build pipeline
- npm (inferred from `package-lock.json` v3)
- Lockfile: Present at `mobile/package-lock.json` (358 MB)
## Frameworks
- React 19.2.0 - UI component library (JavaScript)
- React Native 0.83.2 - iOS/Android cross-platform runtime
- Expo 55.0.8 - React Native framework (SDK 55)
- React DOM 19.2.0 - Web support (for Expo Web)
- Expo Router ~55.0.7 - File-based routing (app directory structure)
- Zustand ^5.0.12 - Global state (auth session, active gym session)
- TanStack React Query ^5.95.2 - Server state, caching, mutations
## Key Dependencies
- @supabase/supabase-js ^2.100.0 - Backend client (auth, database, storage)
- expo-camera ~55.0.11 - Camera access (video/photo capture)
- expo-image-picker ~55.0.13 - Gallery access for media selection
- expo-media-library ~55.0.10 - Local media library browsing
- expo-av ^16.0.8 - Audio/video playback
- expo-location ~55.1.4 - GPS for gym check-in verification
- expo-notifications ~55.0.13 - Push notification handling
- react-native-maps 1.27.2 - Map component for gym locations (optional for MVP)
- @react-native-async-storage/async-storage 2.2.0 - Persistent session storage
- expo-linking ~55.0.8 - Deep linking support
- expo-router ~55.0.7 - File-based routing
- react-native-screens ~4.23.0 - Native screen navigation (performance)
- react-native-safe-area-context ~5.6.2 - Safe area insets (notches, home indicators)
- react-native-url-polyfill ^3.0.0 - URL API polyfill for RN environment
- @expo/ngrok ^4.1.3 - Tunneling for dev server (local to internet)
## Configuration
- `.env` (gitignored) contains:
- Prefix `EXPO_PUBLIC_` makes vars accessible in RN code
- `mobile/app.json` - Expo/EAS build configuration
- `mobile/tsconfig.json` - Strict mode enabled
## Platform Requirements
- Node.js (version not pinned, inferred to be 18+)
- Expo CLI: installed via npm (used in `package.json` scripts)
- iOS: Xcode + simulator (for `expo start --ios`)
- Android: Android Studio/SDK + emulator (for `expo start --android`)
- Hosted on: Expo Go (dev), EAS Build (managed), or native builds (iOS App Store, Google Play)
- Deployment: Expo over-the-air updates (built into Expo framework)
## Run Commands
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Screens (Expo Router): kebab-case (e.g., `sign-up.tsx`, `create-post.tsx`, `log-pr.tsx`)
- Components: PascalCase (e.g., `PostCard.tsx`, `SearchInput.tsx`)
- Utilities/helpers: camelCase (e.g., `supabase.ts`, `gym-map.ts`)
- Types file: `index.ts` (centralized in `src/types/index.ts`)
- Stores: camelCase (e.g., `authStore.ts`, `sessionStore.ts`)
- camelCase for all function names
- Event handlers: `handle[Action]` pattern (e.g., `handleSignUp`, `handleLike`, `handleReport`, `handleCheckIn`)
- Async data loaders: `load[Resource]` pattern (e.g., `loadScreen`, `loadNearbyGyms`, `loadPreviewPosts`)
- Fetch functions: `fetch[Resource]` pattern (e.g., `fetchFeed`, `fetchProfile`, `fetchActiveSession`)
- Private functions in components: no prefix convention observed
- camelCase for all variables (e.g., `session`, `profile`, `loading`, `checkingIn`)
- Boolean flags: prefix with `is` or `has` (e.g., `isLoading`, `inRange`, `isDeleted`, `hasLiked`)
- State arrays/lists: plural nouns (e.g., `gyms`, `posts`, `previewUrls`)
- UI-related: `[resource]Count` (e.g., `likeCount`, `commentCount`, `totalCheckins`)
- Numeric values: no prefix convention
- PascalCase for all type names (e.g., `Profile`, `Gym`, `GymSession`, `Post`)
- Type object fields: snake_case matching database columns (e.g., `avatar_url`, `display_name`, `home_gym_id`, `checked_in_at`)
- Union types for variants: 'literal' | 'literal' (e.g., `type FeedTab = 'foryou' | 'gym'`)
- Enum-like unions: UPPER_SNAKE_CASE values (e.g., `type ReportReason = 'spam' | 'nudity' | 'harassment'`)
## Code Style
- No explicit formatter configured (no .prettierrc, .eslintrc, or biome.json detected)
- Observed style: 2-space indentation, semicolons present, trailing commas in multi-line
- Line length: appears to target ~100 characters based on observed code wrapping
- No linting configuration detected (no ESLint, Prettier, or Biome setup)
- TypeScript `strict: true` in `tsconfig.json` — all code must satisfy strict type checking
- React/third-party imports first: `import { useState } from 'react'`
- External packages second: `import { useQuery } from '@tanstack/react-query'`, `import { router } from 'expo-router'`
- Local relative imports last: `import { supabase } from '../../src/lib/supabase'`, `import { useAuthStore } from '../../src/stores/authStore'`
- Sibling imports (same module): `import { Post } from '../../src/types'`
- No blank lines between groups in practice (imports are continuous)
- `@/*` maps to `./src/*` (defined in `tsconfig.json`)
- Usage observed in type imports: `import { Profile } from '../types'` — prefer relative paths, not alias
## Error Handling
- **Supabase operations:** Destructure `{ error, data }` and check `if (error)` before using data
- **Native errors:** Use `Alert.alert('Error', message)` for user-facing errors (not custom toast)
- **Validation errors:** `Alert.alert('Error', 'descriptive message')` before async operations
- **Location/permission failures:** Silent fallback with `try-catch` and continue without data
- **Loading states:** Set `loading: true`, then set `false` in try-finally or after async completes
- **No error boundaries or global error handler** observed — each screen handles its own errors
## Logging
- No logging statements observed in source code
- No structured logging (Sentry, LogRocket, etc.)
- Errors surfaced to user via `Alert.alert()` only
## Comments
- Rare — only algorithmic logic or non-obvious calculations documented
- Example: distance calculation in `checkin.tsx` has inline comments for Haversine formula steps
- No JSDoc or TypeDoc observed
- Not used in codebase
- Types are strongly inferred from TypeScript and context
- Future: custom hooks should document parameters in `src/hooks/README.md` catalogue (template provided)
## Function Design
- Prefer destructured object types over multiple params
- Example (stores): `create<AuthStore>((set) => ({ ... }))` — Zustand factory pattern
- Example (components): `type Props = { post: Post; onLikeToggle?: () => void }` — typed props object
- Optional callbacks use `?.()` optional call pattern
- Async functions always return `Promise<void>` or `Promise<T>`
- Handlers return void (fire-and-forget for mutations)
- Query functions return typed data: `Promise<Post[]>`, `Promise<Gym[]>`
- Error-first pattern: destructure error explicitly, check, then use data
## Module Design
- Named exports: `export const supabase = ...`, `export function PostCard(...) { ... }`, `export const useAuthStore = ...`
- One main export per file (function, component, or store)
- Default exports: screen/page files use `export default function ScreenName() { ... }`
- Types: all exported from `src/types/index.ts`
- No barrel files used
- Direct relative imports from source (e.g., `import { Post } from '../../src/types'`)
## Zustand Stores
- State fields are top-level: `session: Session | null`
- State setters are named `set[Field]`: `setSession`, `setProfile`, `setLoading`
- Async actions call set() inside: `fetchProfile: async (userId) => { const { data } = ...; if (data) set({ profile: data }) }`
- Actions can access state via `get()`: `checkOut: async () => { const session = get().activeSession; ... }`
## React Query Usage
- Query key: array starting with resource name `['feed', tab, userId]`
- Query function: async function that returns data or throws
- Options: `enabled` condition, `staleTime`, refetch controls
- Mutations: `useMutation` + `queryClient.invalidateQueries` on success
## React Native Conventions
- All styles in `StyleSheet.create()` at bottom of component file
- Style prop names: camelCase (e.g., `paddingHorizontal`, `backgroundColor`, `borderRadius`)
- Colors: hex strings (e.g., `'#000'`, `'#E5183A'`, `'#888'`)
- Layout: Flexbox (no CSS Grid) — use `flex`, `flexDirection`, `alignItems`, `justifyContent`, `gap`
- Dimensions: use `Dimensions.get('window')` for responsive sizing
## Key Imports & Paths
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- File-based routing via Expo Router (screens live in `app/` directory)
- Minimal server-side logic (delegated to Supabase)
- Global state split: auth/profile in Zustand, server data in React Query
- Direct Supabase queries in screen components (no service layer abstraction)
- Modal and card presentations defined in root layout
## Layers
- Purpose: Screen UI, user interactions, visual feedback
- Location: `app/` (Expo Router screens) and `src/components/` (reusable components)
- Contains: Screen components, input fields, image galleries, buttons, icons
- Depends on: Zustand stores, React Query hooks, Supabase client, React Native UI primitives
- Used by: Entry point app (`App.tsx` → `_layout.tsx`)
- Purpose: Global auth state and active gym session tracking
- Location: `src/stores/` (Zustand stores)
- Contains: `authStore.ts` (session, profile, signOut), `sessionStore.ts` (activeSession, checkOut)
- Depends on: Supabase client
- Used by: All screens for auth state; checkin, create-post, feed screens for session state
- Purpose: Server state management, caching, synchronization
- Location: Inline in screen components using React Query hooks
- Contains: `useQuery` for reads, `useMutation` for writes, automatic cache invalidation
- Depends on: Supabase client, TanStack React Query
- Used by: Every screen that needs data
- Purpose: Bridge to Supabase (auth, database, storage)
- Location: `src/lib/supabase.ts` (Supabase client initialization)
- Contains: Supabase client with AsyncStorage session persistence
- Depends on: @supabase/supabase-js, AsyncStorage, environment variables
- Used by: Zustand stores, React Query queries in screens, component event handlers
- Purpose: Shared TypeScript definitions
- Location: `src/types/index.ts`
- Contains: Profile, Gym, GymSession, Post, PostMedia, PostComment, PrEntry, Notification, WorkoutTemplate, WorkoutLog, UserStats
- Depends on: None
- Used by: All screens and stores
## Data Flow
## Key Abstractions
- Purpose: Reusable post display in feed with like/report actions
- Location: `src/components/PostCard.tsx`
- Pattern: Takes `post: Post` object, manages local like state, handles media URLs
- Used in: Feed screens, discover screen, profile saved posts
- Purpose: Centralized global state for auth and sessions
- Examples: `useAuthStore()`, `useSessionStore()`
- Pattern: Create stores with actions (methods) that can both update state and call Supabase
- Purpose: Server state management with built-in caching and refetching
- Pattern: Inline in screens, not extracted to custom hooks (yet)
- Strategy: Use query keys with userId, tab, or id to ensure cache isolation
- Purpose: Screen presentations (modal vs. card vs. default)
- Pattern: Defined in root `_layout.tsx` with `presentation: 'modal'` or `'card'`
- Examples: `create-post`, `log-pr`, `add-gym`, `search`, `active-workout`
## Entry Points
- Location: `mobile/App.tsx`
- Triggers: Initial app load (Expo)
- Responsibilities: Entry point for Expo; imported by native app entry
- Location: `mobile/app/_layout.tsx`
- Triggers: After App.tsx loads
- Responsibilities:
- Location: `mobile/app/index.tsx`
- Triggers: After root layout initializes
- Responsibilities:
- Location: `mobile/app/(auth)/welcome.tsx`, `sign-in.tsx`, `sign-up.tsx`, `setup-profile.tsx`
- Triggers: Unauthenticated user
- Responsibilities:
- Location: `mobile/app/(tabs)/discover.tsx`, `feed.tsx`, `checkin.tsx`, `profile.tsx`, `notifications.tsx`, `map.tsx`
- Triggers: Authenticated user navigates to tab
- Responsibilities: Render tab-specific content; each manages own queries
- Location: `mobile/app/post/[id].tsx`
- Triggers: User taps on post in feed
- Responsibilities: Fetch full post, comments, liked status; handle comment posting
- Location: `mobile/app/create-post.tsx`, `log-pr.tsx`, `add-gym.tsx`, `create-workout.tsx`, `search.tsx`, `active-workout.tsx`
- Triggers: User action (e.g., "Post" button, "Log PR" button)
- Responsibilities: Collect input and insert into database; dismiss on success
## Error Handling
- Supabase query errors: caught in try-catch or inline error checks
- Failed mutations: Show `Alert.alert()` with user-friendly error message
- Validation: Done client-side before submission (e.g., media selected, caption exists)
- Location permission: Gracefully continue without location if denied
- Network failures: React Query automatically retries; user sees loading state
- `checkin.tsx`: Check-in failure shows "Could not check in. Try again."
- `PostCard.tsx`: Report submission shows confirmation or error via Alert
- `create-post.tsx`: No active session shows "Check in first" message
## Cross-Cutting Concerns
- No centralized logging framework; errors logged to console in development
- Supabase client logs auth events internally
- Client-side only: media selection, text length, required fields
- Database constraints enforced by Supabase RLS policies and table constraints
- Supabase Auth handles sessions (JWT stored in AsyncStorage via `supabase.ts`)
- Root layout listens to auth state changes
- Every screen checks `useAuthStore().session` to determine access
- RLS policies on all tables ensure users can only see/edit their own data
- Row-level security (RLS) in Supabase enforces user isolation
- All queries use anon client (authenticated via session in header)
- React Query: automatic deduplication, refetch on window focus, 5-minute defaults
- Profile/session: Zustand stores cache for app lifetime (cleared on sign-out)
- Media URLs: Generated on-demand via Supabase storage public URLs (no caching layer)
- Supabase session: persisted to AsyncStorage (mobile-specific)
- Global state (profile): Not persisted; refetched on app start
- React Query cache: In-memory only; lost on app restart
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
