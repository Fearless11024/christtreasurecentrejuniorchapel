# Christ Treasure Centre — Junior Chapel

A plain HTML, CSS, and JavaScript website (no build tools, no npm, no
frameworks) for a church's Junior Chapel program across multiple branches.
Anyone can browse lessons by branch and age group; teachers log in to
upload lessons and files.

The site still needs a backend to store lessons, teacher logins, and
uploaded files — that part uses **Supabase**, a free service. Everything
else is just the plain files in this folder.

## 1. Create a Supabase project

1. Go to https://supabase.com, sign up, click **New project**.
2. Pick any name/region and a database password (save it somewhere).
3. Once ready, open **Project Settings → API** and copy:
   - **Project URL**
   - **anon public** key

## 2. Set up the database and storage

1. In Supabase, open **SQL Editor → New query**.
2. Open `supabase/schema.sql` from this folder, copy all of it, paste it
   in, and click **Run**.
   - This creates the tables, sets permissions so the public can only
     *view* content while teachers manage their own, and creates two
     storage buckets for uploaded videos and files.
   - It also adds four starter classes: Babies (0-4), Children (5-8),
     Juniors (9-12), Teenagers (13-18).

## 3. Paste your keys into the site

Open `js/config.js` in any text editor and replace the two placeholder
values with what you copied in step 1:

```js
const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";
```

Save the file. That's the only file you ever need to edit for setup.

## 4. Create teacher accounts

1. In Supabase, go to **Authentication → Users → Add user**.
2. Enter each teacher's email and a temporary password.
3. Share the login link (`login.html` on your live site) and their
   credentials. There's no public sign-up page on purpose.

## 5. Preview it before going live (optional)

You can't just double-click `index.html` — browsers block some
Supabase requests when opened as a local `file://` page. Instead, run a
tiny local server. If you have Python installed:

```bash
cd ctc-site
python3 -m http.server 8000
```

Then visit http://localhost:8000 in your browser.

## 6. Put it on a real web address

Because this is now plain HTML/CSS/JS with no build step, you have the
simplest possible deploy option:

### Option A — Netlify Drop (easiest, no account needed to try)
1. Go to https://app.netlify.com/drop
2. Drag the whole `ctc-site` folder onto the page.
3. Netlify gives you a live address immediately (like
   `random-name-123.netlify.app`). Make a free account to keep it and
   rename it.

### Option B — Vercel
1. Push this folder to a GitHub repository.
2. Go to https://vercel.com → **Add New → Project** → import the repo.
3. Framework preset: choose **Other** (no build step needed). Click
   **Deploy**.

### Option C — GitHub Pages
1. Push this folder to a GitHub repository.
2. In the repo, go to **Settings → Pages** → set source to the `main`
   branch, root folder. Save.
3. GitHub gives you a live address like
   `yourname.github.io/ctc-site`.

Any of these work — Netlify Drop is the fastest if you just want to see
it live right now.

You can add a custom domain (like `juniorchapel.christtreasurecentre.org`)
from any of these hosts' settings later, if you own one.

## Already ran the schema before this update?

If you set up Supabase before this update, run this once in the SQL
Editor to add the new `branches` table and open up delete permissions
(so any signed-in teacher can remove a mistaken upload, not just the
person who added it):

```sql
create table if not exists public.branches (
  id text primary key,
  name text not null,
  tag text not null default 'Branch',
  place text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.branches enable row level security;
create policy "branches are publicly viewable" on public.branches for select using (true);
create policy "teachers can insert branches" on public.branches for insert to authenticated with check (true);
create policy "teachers can update branches" on public.branches for update to authenticated using (true);
create policy "teachers can delete branches" on public.branches for delete to authenticated using (true);

insert into public.branches (id, name, tag, place, sort_order) values
  ('yaba', 'Yaba', 'Headquarters', 'Lagos, Nigeria', 1),
  ('lekki', 'Lekki', 'Branch', 'Lagos, Nigeria', 2),
  ('ijebu-ode', 'Ijebu-Ode', 'Branch', 'Ogun State, Nigeria', 3),
  ('manchester', 'Manchester', 'Branch', 'United Kingdom', 4)
on conflict do nothing;

drop policy if exists "teachers can update own lessons" on public.lessons;
drop policy if exists "teachers can delete own lessons" on public.lessons;
create policy "teachers can update lessons" on public.lessons for update to authenticated using (true);
create policy "teachers can delete lessons" on public.lessons for delete to authenticated using (true);

drop policy if exists "teachers can delete own lesson files" on public.lesson_files;
create policy "teachers can delete lesson files" on public.lesson_files for delete to authenticated using (true);
```

If this is a brand-new project, ignore this section — running the full
`supabase/schema.sql` already includes all of it.

## Getting a "schema cache" error?

If Supabase shows an error mentioning **"schema cache"** — for example
`Could not find the 'branch_id' column of 'lessons' in the schema cache`
— this means the database was changed (like adding the `branches` table)
but Supabase's API layer hasn't refreshed its memory of the table
structure yet. This is a known, common Supabase quirk, not a bug in the
site's code.

**To fix it:** open the SQL Editor in Supabase and run:

```sql
NOTIFY pgrst, 'reload schema';
```

Then refresh your website. If the error persists after a minute, also run:

```sql
grant select, insert, update, delete on
  public.branches, public.classes, public.lessons, public.lesson_files, public.teacher_profiles
  to anon, authenticated;
NOTIFY pgrst, 'reload schema';
```

(The `grant` line is a safety net — it makes sure the public/teacher
access rules can actually apply. It doesn't loosen anything beyond what
the Row Level Security policies already allow.)

If it's still stuck after that, go to **Project Settings → General** and
click **Restart project** — this forces a full refresh.

This is also the most common reason a **visitor can't see a lesson a
teacher just uploaded**: if the schema cache is stale, the page's request
for lessons silently fails and shows "No lessons here yet" even though
the upload worked. Run the fix above and refresh.

## Already ran the schema before this update?

If you set up Supabase before this update, run this once in the SQL
Editor to add teacher chat and visitor counting:

```sql
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references auth.users(id) on delete set null,
  sender_name text not null,
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.chat_messages enable row level security;
create policy "teachers can view chat" on public.chat_messages for select to authenticated using (true);
create policy "teachers can send chat" on public.chat_messages for insert to authenticated with check (auth.uid() = sender_id);
alter publication supabase_realtime add table public.chat_messages;

create table if not exists public.page_visits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);
alter table public.page_visits enable row level security;
create policy "anyone can log a visit" on public.page_visits for insert to anon, authenticated with check (true);
create policy "teachers can view visit counts" on public.page_visits for select to authenticated using (true);
```

If this is a brand-new project, ignore this section — the full
`supabase/schema.sql` already includes all of it.

## Already ran the schema before this update?

If you set up Supabase before this update, run this once in the SQL
Editor to add the events/programme table:

```sql
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
alter table public.events enable row level security;
create policy "events are publicly viewable" on public.events for select using (true);
create policy "teachers can insert events" on public.events for insert to authenticated with check (auth.uid() = created_by);
create policy "teachers can update events" on public.events for update to authenticated using (true);
create policy "teachers can delete events" on public.events for delete to authenticated using (true);
```

## Setting up email for password reset

The "Forgot your password?" flow sends a real email through Supabase's
built-in email service — this works out of the box for a small team with
no extra setup. Two things worth knowing:

- Supabase's free built-in email sender is rate-limited (a handful of
  emails per hour) — fine for a small group of teachers, but if you ever
  hit the limit, wait a bit and try again.
- If reset emails aren't arriving, check the **spam folder** first, then
  check **Authentication → Email Templates** in Supabase to confirm the
  "Reset Password" template is enabled, and **Authentication → URL
  Configuration** to make sure your live site's address (e.g.
  `https://christtreasurecentre.netlify.app`) is added under **Redirect
  URLs** — otherwise Supabase will refuse to send visitors back to
  `reset-password.html` after they click the link.

If a teacher forgets which **email** their account uses (not just the
password), there's intentionally no self-service lookup for that — it's
a privacy/security tradeoff. They should ask the admin who created their
account.

## How it works

- **Landing page** first asks "Are you a visitor or a teacher?" A visitor
  gets the public browsing experience (branch → age-gated class → lessons).
  Choosing "Teacher" sends you to `login.html`. The choice is remembered
  on that device, so it's only asked once.
- **`login.html`** — teacher sign-in. Teachers also pick which branch
  they teach at when logging in; every lesson they upload afterward is
  automatically tagged with that branch (no need to pick it again on
  every upload). It can be changed anytime from the dashboard.
- **`dashboard.html`** — signed-in teachers see their own lessons, their
  current upload branch (with a way to change it), can add branches and
  classes, and delete any lesson.
- **`upload.html`** — the branch is filled in automatically from what was
  chosen at login (with a "change branch" link if needed); still asks
  for class, title, scripture, description, video (YouTube link or
  direct upload up to 200MB), and attachments — PDF, Word, Excel,
  PowerPoint, or WPS files, up to 25MB each.
- **Lesson page** shows who uploaded it and exactly when, has a delete
  button for any signed-in teacher (so a wrong upload can be fixed by
  whoever notices), and video controls: loop, playback speed (for
  uploaded videos), and a cast-to-TV button where the browser supports
  it. YouTube videos get speed/quality/casting from YouTube's own player
  controls automatically.
- **Branches** are stored in the database now (not hard-coded), so adding
  a new branch is just a form on the dashboard — no file editing needed.
- **`chat.html`** — a teachers-only chat room. Messages appear live for
  everyone without refreshing, and an "Online Now" list shows who's
  currently on the page (using Supabase Realtime).
- **Visitor counts** on the dashboard show how many visits happened today
  and in total. One visit is logged per browser per day (not every page
  reload), and no personal information is collected — just a timestamp.
- **"Remember me"** at login: checked (default) keeps a teacher signed in
  across browser restarts; unchecked signs them out once the browser is
  fully closed.
- **"Forgot your password?"** sends a real reset-link email via Supabase.
  There's no lookup for a forgotten *email* — that goes through the admin
  on purpose, for privacy.
- **`events.html`** — a public "Programme & Events" timetable for
  important dates and children's programmes, filterable by branch. Any
  signed-in teacher can add or delete events from `add-event.html`.
- Files are stored in Supabase Storage; only signed-in teachers can
  upload, and any signed-in teacher can edit or delete any lesson
  (enforced by the database, not just the page) — useful for a small
  trusted volunteer team where a co-teacher should be able to fix a
  mistake.

## Customizing

- **Branches:** add new ones right from the teacher dashboard — no file
  editing needed.
- **Colors:** all in `css/style.css` under `:root` at the top.
- **Logo:** replace `assets/ctc-logo.png` with a new image of the same
  name, or update the `src` in each HTML file's `<img class="logo">` tag.
- **File size limits:** `MAX_VIDEO_MB` / `MAX_FILE_MB` at the top of
  `js/upload.js`.
