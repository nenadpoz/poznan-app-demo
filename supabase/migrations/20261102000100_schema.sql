-- Poznan App: šema. Iznosi su numeric(14,2) u RSD.
-- Svaka tabela ima created_at, updated_at, updated_by, deleted_at (meko brisanje zbog offline sinhronizacije)
-- i client_at (kad je izmena nastala na telefonu; prepisuje se u audit_log).

create extension if not exists pgcrypto;

-- ---------- Nalozi ----------
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  slug text not null unique check (slug in ('nenad', 'jovan')),
  name text not null,
  email text,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  bar_colors jsonb not null default '{}'::jsonb,
  notif jsonb not null default '{"push":true,"email":false,"pushWin":{"from":"07:00","to":"21:00"},"emailWin":{"from":"08:00","to":"20:00"}}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  client_at timestamptz
);

create table public.settings (
  id boolean primary key default true check (id), -- uvek jedan red
  pausal_limit numeric(14,2) not null default 6000000,
  pdv_threshold numeric(14,2) not null default 8000000,
  warn_pct numeric(5,2) not null default 80,
  crit_pct numeric(5,2) not null default 95 check (crit_pct > warn_pct),
  backup_every_days int not null default 7,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  client_at timestamptz
);

-- ---------- Firme ----------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  form text not null check (form in ('pausal', 'pdv', 'van_pdv', 'doo')),
  phase text not null default 'neaktivna' check (phase in ('neaktivna', 'aktivna', 'mirovanje', 'zatvorena')),
  address text,
  pib text check (pib ~ '^\d{9}$'),
  mb text check (mb ~ '^\d{8}$'),
  activity text,
  founded date,
  monthly_fee numeric(14,2),
  notes text,
  icon text not null default 'building' check (icon in ('building', 'drill', 'truck', 'wrench', 'briefcase', 'home')),
  logo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  client_at timestamptz
);

-- Istorija firme: promena faze, oblika i ostale izmene (bez logoa/ikonice). Datum zadaje korisnik.
create table public.company_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  kind text not null check (kind in ('phase', 'form', 'edit')),
  from_value text,
  to_value text,
  changes jsonb, -- za 'edit': [{field, from, to}]
  effective_date date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  client_at timestamptz
);
create index on public.company_history (company_id, effective_date desc);

-- ---------- Klijenti i kategorije ----------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'fizicko' check (kind in ('fizicko', 'pravno')),
  name text not null,
  pib text,
  mb text,
  contact_person text,
  city text,
  address text,
  phone text,
  email text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  client_at timestamptz,
  check (kind = 'pravno' or (pib is null and mb is null))
);
create index on public.clients (kind, name);

create table public.labels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color smallint not null default 0 check (color between 0 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  client_at timestamptz
);
create unique index labels_name_uq on public.labels (lower(name)) where deleted_at is null;

-- ---------- Poslovi ----------
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id),
  label_id uuid references public.labels (id),
  assignee text not null default 'oba' check (assignee in ('nenad', 'jovan', 'oba')),
  start_date date,
  start_time time,
  status text not null default 'cekanje' check (status in ('cekanje', 'proces', 'uplata', 'zavrseno')),
  end_date date,
  description text,
  work_address text,
  work_city text,
  payment_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  client_at timestamptz
);
create index on public.jobs (status, start_date);
create index on public.jobs (client_id);

-- Očekivane stavke dok posao „Čeka uplatu“ (null firma = keš)
create table public.job_pending_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id),
  company_id uuid references public.companies (id),
  amount numeric(14,2) not null check (amount > 0),
  description text,
  invoice_no text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  client_at timestamptz
);
create index on public.job_pending_items (job_id);

create table public.job_reminders (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id),
  remind_at timestamptz not null,
  audience text not null default 'me' check (audience in ('me', 'both')),
  created_by uuid not null default auth.uid(),
  note text,
  fired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  client_at timestamptz
);
create index job_reminders_due on public.job_reminders (remind_at) where fired_at is null and deleted_at is null;

create table public.job_photos (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id),
  storage_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  client_at timestamptz
);

-- ---------- Termini i zadaci ----------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  start_time time,
  end_time time,
  client_id uuid references public.clients (id),
  job_id uuid references public.jobs (id),
  label_id uuid references public.labels (id),
  company_id uuid references public.companies (id),
  title text,
  assignee text not null default 'oba' check (assignee in ('nenad', 'jovan', 'oba')),
  status text not null default 'cekanje' check (status in ('cekanje', 'proces', 'zavrseno')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  client_at timestamptz
);
create index on public.appointments (date);

-- Zadatak nema klijenta; opciono je vezan za posao
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  assignee text not null default 'oba' check (assignee in ('nenad', 'jovan', 'oba')),
  due date,
  status text not null default 'cekanje' check (status in ('cekanje', 'proces', 'zavrseno')),
  done_at timestamptz,
  done_by uuid,
  job_id uuid references public.jobs (id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  client_at timestamptz
);
create index on public.tasks (status, due);

-- ---------- Komentari ----------
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('task', 'job', 'company')),
  target_id uuid not null,
  parent_id uuid references public.comments (id),
  user_id uuid not null default auth.uid() references auth.users (id),
  text text not null check (length(trim(text)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  client_at timestamptz
);
create index on public.comments (target_type, target_id, created_at);

-- ---------- Promet ----------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('prihod', 'trosak')),
  amount numeric(14,2) not null check (amount > 0),
  date date not null,
  company_id uuid references public.companies (id), -- null = keš bez računa
  client_id uuid references public.clients (id),
  job_id uuid references public.jobs (id),
  category text not null,
  vat numeric(5,2) not null default 0 check (vat between 0 and 100),
  description text,
  earned_by text check (earned_by in ('nenad', 'jovan')),
  invoice_no text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  client_at timestamptz
);
create index on public.transactions (date);
create index on public.transactions (company_id, date);
create index on public.transactions (job_id);
create unique index transactions_invoice_uq on public.transactions (invoice_no) where invoice_no is not null;

create table public.invoice_counters (
  company_id uuid not null references public.companies (id),
  year int not null,
  last_no int not null default 0,
  primary key (company_id, year)
);

-- ---------- Obaveštenja ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  to_user uuid not null references auth.users (id),
  from_user uuid references auth.users (id),
  type text not null check (type in ('comment', 'reply', 'reminder', 'job_start', 'task_due', 'limit')),
  target_type text check (target_type in ('task', 'job', 'company')),
  target_id uuid,
  comment_id uuid references public.comments (id),
  text text,
  read_at timestamptz,
  push_state text not null default 'pending' check (push_state in ('pending', 'sent', 'skipped', 'failed')),
  email_state text not null default 'pending' check (email_state in ('pending', 'sent', 'skipped', 'failed')),
  send_after timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index notifications_unread on public.notifications (to_user, created_at desc) where read_at is null;
create index notifications_outbox on public.notifications (send_after) where push_state = 'pending' or email_state = 'pending';

create table public.push_tokens (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('android', 'ios', 'web')),
  created_at timestamptz not null default now(),
  primary key (user_id, token)
);

-- „Posao je počeo“ se pita jednom po korisniku za dati početak (start_key = datum + vreme)
create table public.start_prompts (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id),
  start_key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

-- ---------- Audit i backup ----------
create table public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid,
  table_name text not null,
  row_id text,
  action text not null check (action in ('insert', 'update', 'delete')),
  old jsonb,
  new jsonb,
  at timestamptz not null default now(),
  client_at timestamptz
);
create index on public.audit_log (table_name, row_id, at desc);
create index on public.audit_log (at desc);

create table public.backups (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  size bigint,
  storage_path text,
  by uuid references auth.users (id)
);
