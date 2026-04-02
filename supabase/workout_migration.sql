-- ============================================================
-- FITTER — Workout Feature Migration
-- Run this in Supabase SQL Editor after the main schema
-- ============================================================

-- Saved workout templates (e.g. "Push Day", "Leg Day")
create table public.workout_templates (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  name         text not null,
  created_at   timestamptz not null default now()
);

-- Exercises within a template (the planned workout)
create table public.workout_template_exercises (
  id                uuid primary key default gen_random_uuid(),
  template_id       uuid not null references public.workout_templates(id) on delete cascade,
  exercise_name     text not null,
  target_sets       integer not null default 3,
  target_reps       integer not null default 10,
  target_weight_kg  float4,
  order_index       integer not null default 0
);

-- A completed workout log (links template → gym session → optionally a post)
create table public.workout_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  template_id     uuid references public.workout_templates(id) on delete set null,
  gym_session_id  uuid references public.gym_sessions(id) on delete set null,
  post_id         uuid references public.posts(id) on delete set null,
  completed_at    timestamptz not null default now()
);

-- Actual sets recorded during a workout log
create table public.workout_log_sets (
  id             uuid primary key default gen_random_uuid(),
  log_id         uuid not null references public.workout_logs(id) on delete cascade,
  exercise_name  text not null,
  set_number     integer not null default 1,
  reps           integer not null,
  weight_kg      float4,
  created_at     timestamptz not null default now()
);

-- ============================================================
-- RLS POLICIES
-- ============================================================

alter table public.workout_templates enable row level security;
alter table public.workout_template_exercises enable row level security;
alter table public.workout_logs enable row level security;
alter table public.workout_log_sets enable row level security;

-- workout_templates: owner only
create policy "owner can manage templates"
  on public.workout_templates for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- workout_template_exercises: owner via template
create policy "owner can manage template exercises"
  on public.workout_template_exercises for all
  using (
    exists (
      select 1 from public.workout_templates t
      where t.id = template_id and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workout_templates t
      where t.id = template_id and t.user_id = auth.uid()
    )
  );

-- workout_logs: owner only
create policy "owner can manage workout logs"
  on public.workout_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- workout_log_sets can be read on attached posts (for post detail display)
create policy "owner can manage log sets"
  on public.workout_log_sets for all
  using (
    exists (
      select 1 from public.workout_logs l
      where l.id = log_id and l.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workout_logs l
      where l.id = log_id and l.user_id = auth.uid()
    )
  );

-- Allow anyone to read log sets for posts they can see
create policy "anyone can read log sets for public posts"
  on public.workout_log_sets for select
  using (
    exists (
      select 1
      from public.workout_logs l
      join public.posts p on p.id = l.post_id
      where l.id = log_id and p.is_deleted = false
    )
  );
