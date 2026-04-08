-- ============================================================
-- FITTER — Profile Privacy Migration
-- Run this in Supabase SQL Editor after the main schema
-- ============================================================

create table if not exists public.profile_privacy_settings (
  user_id              uuid primary key references public.profiles(id) on delete cascade,
  stats_visibility     text not null default 'public' check (stats_visibility in ('public', 'friends', 'private')),
  calendar_visibility  text not null default 'public' check (calendar_visibility in ('public', 'friends', 'private')),
  saved_visibility     text not null default 'private' check (saved_visibility in ('public', 'friends', 'private')),
  workouts_visibility  text not null default 'private' check (workouts_visibility in ('public', 'friends', 'private')),
  updated_at           timestamptz not null default now()
);

insert into public.profile_privacy_settings (user_id)
select id
from public.profiles
on conflict (user_id) do nothing;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    lower(split_part(new.email, '@', 1)) || '_' || substr(replace(new.id::text, '-', ''), 1, 6),
    split_part(new.email, '@', 1)
  );

  insert into public.profile_privacy_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create or replace function public.can_view_profile_section(owner_id uuid, visibility text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() = owner_id
    or visibility = 'public'
    or (
      visibility = 'friends'
      and exists (
        select 1
        from public.friendships outgoing
        where outgoing.follower_id = auth.uid()
          and outgoing.following_id = owner_id
      )
      and exists (
        select 1
        from public.friendships incoming
        where incoming.follower_id = owner_id
          and incoming.following_id = auth.uid()
      )
    );
$$;

alter table public.profile_privacy_settings enable row level security;

drop policy if exists "Profile privacy settings are publicly readable" on public.profile_privacy_settings;
drop policy if exists "Users can insert own profile privacy settings" on public.profile_privacy_settings;
drop policy if exists "Users can update own profile privacy settings" on public.profile_privacy_settings;

create policy "Profile privacy settings are publicly readable"
  on public.profile_privacy_settings for select using (true);

create policy "Users can insert own profile privacy settings"
  on public.profile_privacy_settings for insert with check (auth.uid() = user_id);

create policy "Users can update own profile privacy settings"
  on public.profile_privacy_settings for update using (auth.uid() = user_id);

create index if not exists profile_privacy_settings_user_id on public.profile_privacy_settings(user_id);

drop policy if exists "Users can read own saves" on public.saved_workouts;
drop policy if exists "Users can read visible saves" on public.saved_workouts;
create policy "Users can read visible saves"
  on public.saved_workouts for select using (
    exists (
      select 1
      from public.profile_privacy_settings privacy
      where privacy.user_id = saved_workouts.user_id
        and public.can_view_profile_section(saved_workouts.user_id, privacy.saved_visibility)
    )
  );

drop policy if exists "Users can read own PRs" on public.pr_entries;
drop policy if exists "Users can read visible PRs" on public.pr_entries;
create policy "Users can read visible PRs"
  on public.pr_entries for select using (
    exists (
      select 1
      from public.profile_privacy_settings privacy
      where privacy.user_id = pr_entries.user_id
        and public.can_view_profile_section(pr_entries.user_id, privacy.stats_visibility)
    )
  );

drop policy if exists "Workout templates are publicly readable" on public.workout_templates;
drop policy if exists "Workout templates follow profile privacy" on public.workout_templates;
create policy "Workout templates follow profile privacy"
  on public.workout_templates for select using (
    exists (
      select 1
      from public.profile_privacy_settings privacy
      where privacy.user_id = workout_templates.user_id
        and public.can_view_profile_section(workout_templates.user_id, privacy.workouts_visibility)
    )
  );

drop policy if exists "Workout exercises are publicly readable" on public.workout_template_exercises;
drop policy if exists "Workout exercises follow profile privacy" on public.workout_template_exercises;
create policy "Workout exercises follow profile privacy"
  on public.workout_template_exercises for select using (
    exists (
      select 1
      from public.workout_templates template
      join public.profile_privacy_settings privacy on privacy.user_id = template.user_id
      where template.id = workout_template_exercises.template_id
        and public.can_view_profile_section(template.user_id, privacy.workouts_visibility)
    )
  );

drop policy if exists "User stats are publicly readable" on public.user_stats;
drop policy if exists "User stats follow profile privacy" on public.user_stats;
create policy "User stats follow profile privacy"
  on public.user_stats for select using (
    exists (
      select 1
      from public.profile_privacy_settings privacy
      where privacy.user_id = user_stats.user_id
        and public.can_view_profile_section(user_stats.user_id, privacy.stats_visibility)
    )
  );
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profile_privacy_settings'
      and column_name = 'prs_visibility'
  ) then
    execute $sql$
      update public.profile_privacy_settings
      set stats_visibility = case
        when stats_visibility = 'private' or prs_visibility = 'private' then 'private'
        when stats_visibility = 'friends' or prs_visibility = 'friends' then 'friends'
        else 'public'
      end
    $sql$;

    execute 'alter table public.profile_privacy_settings drop column prs_visibility';
  end if;
end $$;
