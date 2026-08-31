-- ============================================================
-- Christ Treasure Centre - Junior Chapel
-- Run this in the Supabase SQL editor (Project > SQL Editor > New query)
-- ============================================================

-- ---------- BRANCHES ----------
create table if not exists public.branches (
  id text primary key,
  name text not null,
  tag text not null default 'Branch',
  place text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- CLASSES (age groups, shared across all branches) ----------
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  age_range text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- LESSONS ----------
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  branch_id text references public.branches(id) on delete set null,
  class_id uuid references public.classes(id) on delete set null,
  title text not null,
  description text,
  scripture_reference text,
  youtube_url text,
  video_path text,        -- path inside the lesson-videos storage bucket
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text,   -- snapshot of teacher name for display
  created_at timestamptz not null default now()
);

-- ---------- LESSON FILES (PDF, Word, Excel, PowerPoint, WPS, etc.) ----------
create table if not exists public.lesson_files (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  file_path text not null, -- path inside the lesson-files storage bucket
  file_name text not null,
  created_at timestamptz not null default now()
);

-- ---------- CHAT MESSAGES (teachers-only chat room) ----------
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references auth.users(id) on delete set null,
  sender_name text not null,
  content text not null,
  created_at timestamptz not null default now()
);

-- ---------- PAGE VISITS (simple visitor counter, no personal data) ----------
create table if not exists public.page_visits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- ---------- EVENTS (programmes, special dates) ----------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  branch_id text references public.branches(id) on delete set null,
  title text not null,
  description text,
  event_date date not null,
  event_time text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- TEACHER PROFILES ----------
create table if not exists public.teacher_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.branches enable row level security;
alter table public.classes enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_files enable row level security;
alter table public.teacher_profiles enable row level security;
alter table public.chat_messages enable row level security;
alter table public.page_visits enable row level security;
alter table public.events enable row level security;

create policy "branches are publicly viewable" on public.branches
  for select using (true);
create policy "teachers can insert branches" on public.branches
  for insert to authenticated with check (true);
create policy "teachers can update branches" on public.branches
  for update to authenticated using (true);
create policy "teachers can delete branches" on public.branches
  for delete to authenticated using (true);

create policy "classes are publicly viewable" on public.classes
  for select using (true);
create policy "teachers can insert classes" on public.classes
  for insert to authenticated with check (true);
create policy "teachers can update classes" on public.classes
  for update to authenticated using (true);
create policy "teachers can delete classes" on public.classes
  for delete to authenticated using (true);

-- Any signed-in teacher can manage any lesson (not just their own) --
-- this makes it easy for a co-teacher to fix or remove a wrong upload.
create policy "lessons are publicly viewable" on public.lessons
  for select using (true);
create policy "teachers can insert lessons" on public.lessons
  for insert to authenticated with check (auth.uid() = created_by);
create policy "teachers can update lessons" on public.lessons
  for update to authenticated using (true);
create policy "teachers can delete lessons" on public.lessons
  for delete to authenticated using (true);

create policy "lesson files are publicly viewable" on public.lesson_files
  for select using (true);
create policy "teachers can insert lesson files" on public.lesson_files
  for insert to authenticated with check (
    exists (
      select 1 from public.lessons l
      where l.id = lesson_id and l.created_by = auth.uid()
    )
  );
create policy "teachers can delete lesson files" on public.lesson_files
  for delete to authenticated using (true);

create policy "teachers can view profiles" on public.teacher_profiles
  for select to authenticated using (true);
create policy "teachers can upsert own profile" on public.teacher_profiles
  for insert to authenticated with check (auth.uid() = id);
create policy "teachers can update own profile" on public.teacher_profiles
  for update to authenticated using (auth.uid() = id);

-- Chat: only signed-in teachers can read or post.
create policy "teachers can view chat" on public.chat_messages
  for select to authenticated using (true);
create policy "teachers can send chat" on public.chat_messages
  for insert to authenticated with check (auth.uid() = sender_id);

-- Page visits: anyone (including anonymous visitors) can log a visit,
-- but only signed-in teachers can read the counts back.
create policy "anyone can log a visit" on public.page_visits
  for insert to anon, authenticated with check (true);
create policy "teachers can view visit counts" on public.page_visits
  for select to authenticated using (true);

-- Turn on Realtime for chat so messages appear live without refreshing.
alter publication supabase_realtime add table public.chat_messages;

-- Events/programmes: anyone can view, any signed-in teacher can manage.
create policy "events are publicly viewable" on public.events
  for select using (true);
create policy "teachers can insert events" on public.events
  for insert to authenticated with check (auth.uid() = created_by);
create policy "teachers can update events" on public.events
  for update to authenticated using (true);
create policy "teachers can delete events" on public.events
  for delete to authenticated using (true);

-- ============================================================
-- Storage buckets (public read, teachers-only write)
-- ============================================================
insert into storage.buckets (id, name, public)
  values ('lesson-videos', 'lesson-videos', true)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('lesson-files', 'lesson-files', true)
  on conflict (id) do nothing;

create policy "public can read lesson videos" on storage.objects
  for select using (bucket_id = 'lesson-videos');
create policy "teachers can upload lesson videos" on storage.objects
  for insert to authenticated with check (bucket_id = 'lesson-videos');
create policy "teachers can delete own lesson videos" on storage.objects
  for delete to authenticated using (bucket_id = 'lesson-videos' and owner = auth.uid());

create policy "public can read lesson files" on storage.objects
  for select using (bucket_id = 'lesson-files');
create policy "teachers can upload lesson files" on storage.objects
  for insert to authenticated with check (bucket_id = 'lesson-files');
create policy "teachers can delete own lesson files" on storage.objects
  for delete to authenticated using (bucket_id = 'lesson-files' and owner = auth.uid());

-- ============================================================
-- Starter branches (add more anytime from the teacher dashboard)
-- ============================================================
insert into public.branches (id, name, tag, place, sort_order) values
  ('yaba', 'Yaba', 'Headquarters', 'Lagos, Nigeria', 1),
  ('lekki', 'Lekki', 'Branch', 'Lagos, Nigeria', 2),
  ('ijebu-ode', 'Ijebu-Ode', 'Branch', 'Ogun State, Nigeria', 3),
  ('manchester', 'Manchester', 'Branch', 'United Kingdom', 4)
on conflict do nothing;

-- ============================================================
-- Starter classes (age groups)
-- ============================================================
insert into public.classes (name, age_range, sort_order) values
  ('Babies', 'Ages 0-4', 1),
  ('Children', 'Ages 5-8', 2),
  ('Juniors', 'Ages 9-12', 3),
  ('Teenagers', 'Ages 13-18', 4)
on conflict do nothing;
