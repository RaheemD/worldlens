-- =============================================================
-- Storage: public "avatars" bucket for profile pictures
-- Run this in the Supabase SQL Editor (SQL Editor -> New query -> Run).
-- The app uploads files named "<user_id>-<timestamp>.<ext>" to this bucket
-- and reads them via public URLs, so the bucket must be public.
-- =============================================================

-- Create the bucket (id = name = 'avatars'), public read.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Anyone can READ avatars (public profile pictures).
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select
  using (bucket_id = 'avatars');

-- A signed-in user may UPLOAD only files prefixed with their own user id
-- (matches the app's "<user_id>-..." naming).
drop policy if exists "avatars_owner_insert" on storage.objects;
create policy "avatars_owner_insert" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and name like (auth.uid()::text || '-%')
  );

-- A signed-in user may UPDATE (upsert) only their own files.
drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and name like (auth.uid()::text || '-%')
  )
  with check (
    bucket_id = 'avatars'
    and name like (auth.uid()::text || '-%')
  );

-- A signed-in user may DELETE only their own files.
drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and name like (auth.uid()::text || '-%')
  );
