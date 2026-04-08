export type Profile = {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  bio: string | null
  home_gym_id: string | null
  streak_current: number
  streak_longest: number
  total_checkins: number
  is_banned: boolean
  created_at: string
  updated_at: string
}

export type SocialRelationship = {
  isFollowing: boolean
  isFollowedBy: boolean
  isFriend: boolean
}

export type SocialCounts = {
  followerCount: number
  followingCount: number
}

export type SocialProfileSearchResult = Profile & SocialRelationship

export type ProfileVisibility = 'public' | 'friends' | 'private'

export type ProfilePrivacySettings = {
  user_id: string
  stats_visibility: ProfileVisibility
  calendar_visibility: ProfileVisibility
  saved_visibility: ProfileVisibility
  workouts_visibility: ProfileVisibility
  updated_at: string
}

export type Gym = {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  radius_meters: number
  is_verified: boolean
  created_at: string
}

export type GymSession = {
  id: string
  user_id: string
  gym_id: string
  location_verified: boolean
  checked_in_at: string
  checked_out_at: string | null
  session_date: string
  created_at: string
  gym?: Gym
}

export type Post = {
  id: string
  user_id: string
  session_id: string
  gym_id: string
  caption: string | null
  like_count: number
  comment_count: number
  is_deleted: boolean
  post_date: string
  created_at: string
  profile?: Profile
  gym?: Gym
  post_media?: PostMedia[]
  user_has_liked?: boolean
  user_has_saved?: boolean
}

export type PostMedia = {
  id: string
  post_id: string
  media_type: 'photo' | 'video'
  storage_path: string
  width: number | null
  height: number | null
  duration_seconds: number | null
  created_at: string
}

export type PostComment = {
  id: string
  post_id: string
  user_id: string
  body: string
  is_deleted: boolean
  created_at: string
  profile?: Profile
}

export type PrEntry = {
  id: string
  user_id: string
  exercise_name: string
  weight_kg: number
  reps: number
  notes: string | null
  logged_at: string
  created_at: string
}

export type Notification = {
  id: string
  user_id: string
  type: 'like' | 'comment' | 'follow' | 'achievement'
  actor_id: string | null
  post_id: string | null
  body: string
  is_read: boolean
  created_at: string
  actor?: Profile
}

export type ReportReason = 'spam' | 'nudity' | 'harassment' | 'fake_checkin' | 'other'

export type WorkoutTemplate = {
  id: string
  user_id: string
  name: string
  created_at: string
  exercises?: WorkoutTemplateExercise[]
}

export type WorkoutTemplateExercise = {
  id: string
  template_id: string
  exercise_name: string
  target_sets: number
  target_reps: number
  target_weight_kg: number | null
  order_index: number
}

export type WorkoutLog = {
  id: string
  user_id: string
  template_id: string | null
  gym_session_id: string | null
  post_id: string | null
  completed_at: string
  template?: WorkoutTemplate
  sets?: WorkoutLogSet[]
}

export type WorkoutLogSet = {
  id: string
  log_id: string
  exercise_name: string
  set_number: number
  reps: number
  weight_kg: number | null
  created_at: string
}

export type UserStats = {
  user_id: string
  weight_kg: number | null
  height_cm: number | null
  bench_1rm_kg: number | null
  squat_1rm_kg: number | null
  deadlift_1rm_kg: number | null
  ohp_1rm_kg: number | null
  updated_at: string
}
