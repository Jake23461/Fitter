-- Fix denormalized count triggers so they can update protected tables under RLS.
-- Run this in Supabase SQL Editor against an existing project.

create or replace function public.handle_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update public.posts
    set like_count = like_count + 1
    where id = new.post_id;
  elsif TG_OP = 'DELETE' then
    update public.posts
    set like_count = greatest(like_count - 1, 0)
    where id = old.post_id;
  end if;
  return null;
end;
$$;

create or replace function public.handle_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update public.posts
    set comment_count = comment_count + 1
    where id = new.post_id;
  elsif TG_OP = 'UPDATE' and new.is_deleted = true and old.is_deleted = false then
    update public.posts
    set comment_count = greatest(comment_count - 1, 0)
    where id = new.post_id;
  end if;
  return null;
end;
$$;

create or replace function public.handle_checkin_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update public.profiles
    set total_checkins = total_checkins + 1
    where id = new.user_id;
  end if;
  return null;
end;
$$;
