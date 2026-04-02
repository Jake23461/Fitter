-- ============================================================
-- FITTER — Full Schema
-- Run this in Supabase SQL Editor (supabase.com → SQL Editor)
-- ============================================================

-- Enable UUID extension (already enabled on Supabase by default)
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- profiles (1:1 with auth.users, auto-created on sign-up)
create table public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  username         text unique not null,
  display_name     text not null default '',
  avatar_url       text,
  bio              text,
  home_gym_id      uuid,
  streak_current   integer not null default 0,
  streak_longest   integer not null default 0,
  total_checkins   integer not null default 0,
  is_banned        boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint bio_length check (char_length(bio) <= 120),
  constraint display_name_length check (char_length(display_name) <= 60),
  constraint username_length check (char_length(username) <= 30),
  constraint username_format check (username ~ '^[a-z0-9_]+$')
);

-- gyms
create table public.gyms (
  id             uuid primary key default uuid_generate_v4(),
  name           text not null,
  address        text not null default '',
  lat            float8 not null default 0,
  lng            float8 not null default 0,
  radius_meters  integer not null default 150,
  is_verified    boolean not null default false,
  submitted_by   uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);

-- gym_sessions
create table public.gym_sessions (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  gym_id            uuid not null references public.gyms(id) on delete cascade,
  location_verified boolean not null default false,
  checked_in_at     timestamptz not null default now(),
  checked_out_at    timestamptz,
  session_date      date not null default current_date,
  created_at        timestamptz not null default now()
);

-- only one active session per user at a time
create unique index gym_sessions_one_active_per_user
  on public.gym_sessions(user_id)
  where checked_out_at is null;

-- only one post per user per calendar day
-- (add separately if schema already applied: alter table public.posts add constraint posts_one_per_user_per_day unique (user_id, post_date);)

-- posts
create table public.posts (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  session_id    uuid not null references public.gym_sessions(id) on delete cascade,
  gym_id        uuid not null references public.gyms(id) on delete cascade,
  caption       text,
  like_count    integer not null default 0,
  comment_count integer not null default 0,
  is_deleted    boolean not null default false,
  post_date     date not null default current_date,
  created_at    timestamptz not null default now(),
  constraint caption_length check (char_length(caption) <= 280),
  constraint posts_one_per_user_per_day unique (user_id, post_date)
);

-- post_media
create table public.post_media (
  id               uuid primary key default uuid_generate_v4(),
  post_id          uuid not null references public.posts(id) on delete cascade,
  media_type       text not null check (media_type in ('photo', 'video')),
  storage_path     text not null,
  width            integer,
  height           integer,
  duration_seconds float4,
  created_at       timestamptz not null default now()
);

-- post_likes
create table public.post_likes (
  id         uuid primary key default uuid_generate_v4(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

-- post_comments
create table public.post_comments (
  id         uuid primary key default uuid_generate_v4(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  constraint body_length check (char_length(body) <= 500)
);

-- friendships (follow graph, unidirectional)
create table public.friendships (
  id           uuid primary key default uuid_generate_v4(),
  follower_id  uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (follower_id, following_id),
  constraint no_self_follow check (follower_id != following_id)
);

-- saved_workouts
create table public.saved_workouts (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  post_id    uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, post_id)
);

-- pr_entries
create table public.pr_entries (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  exercise_name text not null,
  weight_kg     float4 not null,
  reps          integer not null,
  notes         text,
  logged_at     date not null default current_date,
  created_at    timestamptz not null default now(),
  constraint notes_length check (char_length(notes) <= 200)
);

-- achievements
create table public.achievements (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  achievement_key text not null,
  earned_at       timestamptz not null default now(),
  unique (user_id, achievement_key)
);

-- reports
create table public.reports (
  id               uuid primary key default uuid_generate_v4(),
  reporter_id      uuid not null references public.profiles(id) on delete cascade,
  post_id          uuid references public.posts(id) on delete set null,
  reported_user_id uuid references public.profiles(id) on delete set null,
  reason           text not null check (reason in ('spam', 'nudity', 'harassment', 'fake_checkin', 'other')),
  notes            text,
  status           text not null default 'pending' check (status in ('pending', 'reviewed', 'actioned', 'dismissed')),
  reviewed_by      uuid references public.profiles(id) on delete set null,
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now(),
  constraint notes_length check (char_length(notes) <= 500),
  constraint report_has_target check (post_id is not null or reported_user_id is not null)
);

-- notifications
create table public.notifications (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null check (type in ('like', 'comment', 'follow', 'achievement')),
  actor_id   uuid references public.profiles(id) on delete set null,
  post_id    uuid references public.posts(id) on delete cascade,
  body       text not null,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index profiles_home_gym_id on public.profiles(home_gym_id);

create index gyms_lat_lng on public.gyms(lat, lng);
create index gyms_is_verified on public.gyms(is_verified);

create index gym_sessions_user_date on public.gym_sessions(user_id, session_date);
create index gym_sessions_gym_date  on public.gym_sessions(gym_id, session_date);

create index posts_gym_date      on public.posts(gym_id, post_date);
create index posts_user_date     on public.posts(user_id, post_date);
create index posts_created_at    on public.posts(created_at desc);

create index post_media_post_id  on public.post_media(post_id);

create index post_likes_user_id  on public.post_likes(user_id);

create index post_comments_post_created on public.post_comments(post_id, created_at);

create index friendships_following_id on public.friendships(following_id);

create index saved_workouts_user_id on public.saved_workouts(user_id);

create index pr_entries_user_exercise_date on public.pr_entries(user_id, exercise_name, logged_at);

create index reports_status       on public.reports(status);
create index reports_reported_user on public.reports(reported_user_id, created_at);
create index reports_post_id      on public.reports(post_id);

create index notifications_user_unread on public.notifications(user_id, is_read, created_at desc);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-update updated_at on profiles
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    -- generate a temporary username from email prefix + random suffix
    lower(split_part(new.email, '@', 1)) || '_' || substr(replace(new.id::text, '-', ''), 1, 6),
    split_part(new.email, '@', 1)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Maintain like_count on posts
create or replace function public.handle_like_count()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
  elsif TG_OP = 'DELETE' then
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger post_likes_count
  after insert or delete on public.post_likes
  for each row execute function public.handle_like_count();

-- Maintain comment_count on posts
create or replace function public.handle_comment_count()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif TG_OP = 'UPDATE' and new.is_deleted = true and old.is_deleted = false then
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = new.post_id;
  end if;
  return null;
end;
$$;

create trigger post_comments_count
  after insert or update on public.post_comments
  for each row execute function public.handle_comment_count();

-- Maintain total_checkins on profiles
create or replace function public.handle_checkin_count()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    update public.profiles set total_checkins = total_checkins + 1 where id = new.user_id;
  end if;
  return null;
end;
$$;

create trigger gym_sessions_checkin_count
  after insert on public.gym_sessions
  for each row execute function public.handle_checkin_count();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles       enable row level security;
alter table public.gyms           enable row level security;
alter table public.gym_sessions   enable row level security;
alter table public.posts          enable row level security;
alter table public.post_media     enable row level security;
alter table public.post_likes     enable row level security;
alter table public.post_comments  enable row level security;
alter table public.friendships    enable row level security;
alter table public.saved_workouts enable row level security;
alter table public.pr_entries     enable row level security;
alter table public.achievements   enable row level security;
alter table public.reports        enable row level security;
alter table public.notifications  enable row level security;

-- profiles
create policy "Profiles are publicly readable"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- gyms
create policy "Gyms are publicly readable"
  on public.gyms for select using (true);

create policy "Authenticated users can submit gyms"
  on public.gyms for insert with check (auth.uid() is not null);

-- gym_sessions
create policy "Sessions are publicly readable"
  on public.gym_sessions for select using (true);

create policy "Users can insert own sessions"
  on public.gym_sessions for insert with check (auth.uid() = user_id);

create policy "Users can update own sessions"
  on public.gym_sessions for update using (auth.uid() = user_id);

-- posts
create policy "Non-deleted posts are publicly readable"
  on public.posts for select using (is_deleted = false);

create policy "Users can insert own posts"
  on public.posts for insert with check (auth.uid() = user_id);

create policy "Users can soft-delete own posts"
  on public.posts for update using (auth.uid() = user_id);

-- post_media
create policy "Post media is publicly readable"
  on public.post_media for select using (true);

create policy "Users can insert own post media"
  on public.post_media for insert with check (
    auth.uid() = (select user_id from public.posts where id = post_id)
  );

-- post_likes
create policy "Likes are publicly readable"
  on public.post_likes for select using (true);

create policy "Users can like posts"
  on public.post_likes for insert with check (auth.uid() = user_id);

create policy "Users can unlike posts"
  on public.post_likes for delete using (auth.uid() = user_id);

-- post_comments
create policy "Non-deleted comments are publicly readable"
  on public.post_comments for select using (is_deleted = false);

create policy "Users can comment"
  on public.post_comments for insert with check (auth.uid() = user_id);

create policy "Users can soft-delete own comments"
  on public.post_comments for update using (auth.uid() = user_id);

-- friendships
create policy "Friendships are publicly readable"
  on public.friendships for select using (true);

create policy "Users can follow others"
  on public.friendships for insert with check (auth.uid() = follower_id);

create policy "Users can unfollow"
  on public.friendships for delete using (auth.uid() = follower_id);

-- saved_workouts
create policy "Users can read own saves"
  on public.saved_workouts for select using (auth.uid() = user_id);

create policy "Users can save posts"
  on public.saved_workouts for insert with check (auth.uid() = user_id);

create policy "Users can unsave posts"
  on public.saved_workouts for delete using (auth.uid() = user_id);

-- pr_entries
create policy "Users can read own PRs"
  on public.pr_entries for select using (auth.uid() = user_id);

create policy "Users can insert own PRs"
  on public.pr_entries for insert with check (auth.uid() = user_id);

create policy "Users can delete own PRs"
  on public.pr_entries for delete using (auth.uid() = user_id);

-- achievements
create policy "Users can read own achievements"
  on public.achievements for select using (auth.uid() = user_id);

-- reports
create policy "Users can submit reports"
  on public.reports for insert with check (auth.uid() = reporter_id);

-- notifications
create policy "Users can read own notifications"
  on public.notifications for select using (auth.uid() = user_id);

create policy "Users can mark own notifications read"
  on public.notifications for update using (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKETS
-- (Run these separately if the SQL editor complains —
--  or create buckets manually in Storage tab)
-- ============================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('post-media', 'post-media', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('gym-assets', 'gym-assets', true)
on conflict (id) do nothing;

-- Storage policies: avatars
create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies: post-media
create policy "Post media is publicly accessible"
  on storage.objects for select
  using (bucket_id = 'post-media');

create policy "Users can upload their own post media"
  on storage.objects for insert
  with check (
    bucket_id = 'post-media'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own post media"
  on storage.objects for delete
  using (
    bucket_id = 'post-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can move their own post media"
  on storage.objects for update
  using (
    bucket_id = 'post-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'post-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies: gym-assets (read-only for users)
create policy "Gym assets are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'gym-assets');

-- ============================================================
-- WORKOUT TEMPLATES
-- (Run these after the initial schema if already applied)
-- ============================================================

-- workout_templates: user-created named workout plans
create table public.workout_templates (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

-- workout_template_exercises: ordered exercises within a template
create table public.workout_template_exercises (
  id               uuid primary key default uuid_generate_v4(),
  template_id      uuid not null references public.workout_templates(id) on delete cascade,
  exercise_name    text not null,
  target_sets      integer not null default 3,
  target_reps      integer not null default 10,
  target_weight_kg float4,
  order_index      integer not null default 0
);

-- user_stats: one row per user — body measurements + big-lift 1RMs
-- Publicly readable so followers can see stats on a profile
create table public.user_stats (
  user_id         uuid primary key references public.profiles(id) on delete cascade,
  weight_kg       float4,
  height_cm       float4,
  bench_1rm_kg    float4,
  squat_1rm_kg    float4,
  deadlift_1rm_kg float4,
  ohp_1rm_kg      float4,
  updated_at      timestamptz not null default now()
);

-- indexes
create index workout_templates_user_id on public.workout_templates(user_id);
create index workout_template_exercises_template_id on public.workout_template_exercises(template_id);

-- RLS
alter table public.workout_templates          enable row level security;
alter table public.workout_template_exercises enable row level security;
alter table public.user_stats                 enable row level security;

-- workout_templates: publicly readable, owner can CRUD
create policy "Workout templates are publicly readable"
  on public.workout_templates for select using (true);
create policy "Users can insert own workout templates"
  on public.workout_templates for insert with check (auth.uid() = user_id);
create policy "Users can update own workout templates"
  on public.workout_templates for update using (auth.uid() = user_id);
create policy "Users can delete own workout templates"
  on public.workout_templates for delete using (auth.uid() = user_id);

-- workout_template_exercises: follow parent template ownership
create policy "Workout exercises are publicly readable"
  on public.workout_template_exercises for select using (true);
create policy "Users can insert own template exercises"
  on public.workout_template_exercises for insert with check (
    auth.uid() = (select user_id from public.workout_templates where id = template_id)
  );
create policy "Users can update own template exercises"
  on public.workout_template_exercises for update using (
    auth.uid() = (select user_id from public.workout_templates where id = template_id)
  );
create policy "Users can delete own template exercises"
  on public.workout_template_exercises for delete using (
    auth.uid() = (select user_id from public.workout_templates where id = template_id)
  );

-- user_stats: publicly readable, owner can upsert
create policy "User stats are publicly readable"
  on public.user_stats for select using (true);
create policy "Users can insert own stats"
  on public.user_stats for insert with check (auth.uid() = user_id);
create policy "Users can update own stats"
  on public.user_stats for update using (auth.uid() = user_id);
