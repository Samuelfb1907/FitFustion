-- ============================================================================
--  Migration 056 - Fortschritts-Fotos (#76e)
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--
--  Privater Storage-Bucket 'progress-photos' (max 5 MB, nur Bildformate) + Metadaten-
--  Tabelle. Jeder Nutzer kann NUR seinen eigenen Ordner (Pfad beginnt mit seiner uid)
--  lesen/schreiben/loeschen. Anzeige in der App ueber signierte URLs (Bucket ist privat).
-- ============================================================================

-- 1) Privater Bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- 2) Storage-Policies: nur der eigene Ordner (erstes Pfadsegment = auth.uid()).
drop policy if exists "pp_read_own" on storage.objects;
create policy "pp_read_own" on storage.objects for select to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "pp_insert_own" on storage.objects;
create policy "pp_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "pp_delete_own" on storage.objects;
create policy "pp_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- 3) Metadaten-Tabelle (Pfad + optionales Gewicht + Aufnahmedatum)
create table if not exists public.progress_photos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  path       text not null,
  weight_kg  numeric(5,1),
  taken_at   date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists progress_photos_user_idx on public.progress_photos(user_id, taken_at desc);

alter table public.progress_photos enable row level security;
drop policy if exists "progress_photos_rw_own" on public.progress_photos;
create policy "progress_photos_rw_own" on public.progress_photos
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
