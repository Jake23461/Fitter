-- ============================================================
-- Notification triggers for likes and comments
-- Run in Supabase SQL Editor
-- ============================================================

-- Trigger function: insert a notification when someone likes a post
-- Uses SECURITY DEFINER so it can insert into notifications regardless of RLS
create or replace function public.handle_like_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_owner uuid;
begin
  -- Find who owns the post
  select user_id into post_owner from public.posts where id = new.post_id;

  -- Don't notify if someone likes their own post
  if post_owner is null or post_owner = new.user_id then
    return new;
  end if;

  insert into public.notifications (user_id, type, actor_id, post_id, body)
  values (
    post_owner,
    'like',
    new.user_id,
    new.post_id,
    'liked your post.'
  );

  return new;
end;
$$;

-- Drop old trigger if it exists, then recreate
drop trigger if exists post_likes_notify on public.post_likes;

create trigger post_likes_notify
  after insert on public.post_likes
  for each row execute function public.handle_like_notification();


-- Trigger function: insert a notification when someone comments on a post
create or replace function public.handle_comment_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_owner uuid;
begin
  -- Find who owns the post
  select user_id into post_owner from public.posts where id = new.post_id;

  -- Don't notify if someone comments on their own post
  if post_owner is null or post_owner = new.user_id then
    return new;
  end if;

  insert into public.notifications (user_id, type, actor_id, post_id, body)
  values (
    post_owner,
    'comment',
    new.user_id,
    new.post_id,
    'commented on your post.'
  );

  return new;
end;
$$;

drop trigger if exists post_comments_notify on public.post_comments;

create trigger post_comments_notify
  after insert on public.post_comments
  for each row execute function public.handle_comment_notification();

-- Trigger function: insert a notification when someone follows a user
create or replace function public.handle_follow_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.follower_id = new.following_id then
    return new;
  end if;

  insert into public.notifications (user_id, type, actor_id, body)
  values (
    new.following_id,
    'follow',
    new.follower_id,
    'started following you.'
  );

  return new;
end;
$$;

create index if not exists friendships_follower_id on public.friendships(follower_id);

drop trigger if exists friendships_notify on public.friendships;

create trigger friendships_notify
  after insert on public.friendships
  for each row execute function public.handle_follow_notification();
