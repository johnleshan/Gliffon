-- Run this whole file in the Supabase SQL editor once per project.

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  glyphname text unique not null,
  name text not null,
  symbol text not null default '✦',
  created timestamptz default now()
);

create table if not exists wall (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  symbol text not null,
  label text not null,
  note text,
  likes int not null default 0,
  author uuid not null references users(id),
  wall boolean not null default false,
  created timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conv text not null,
  sender uuid not null references users(id),
  text text not null,
  created timestamptz not null default now()
);

create index if not exists wall_created_idx on wall (created desc);
create index if not exists messages_conv_idx on messages (conv, created asc);

create or replace function bump_like(row_id uuid)
returns void language sql as $$
  update wall set likes = likes + 1 where id = row_id;
$$;

alter table users enable row level security;
alter table wall enable row level security;
alter table messages enable row level security;

-- MVP: open policies; tighten before launch.
drop policy if exists "open users" on users;
drop policy if exists "open wall" on wall;
drop policy if exists "open messages" on messages;
drop policy if exists "open wall select" on wall;
drop policy if exists "open messages select" on messages;
drop policy if exists "open wall delete" on wall;

create policy "open users" on users for all using (true) with check (true);
create policy "open wall select" on wall for select using (true);
create policy "open wall insert" on wall for insert with check (true);
create policy "open wall update" on wall for update using (true);
create policy "open wall delete" on wall for delete using (true);
create policy "open messages select" on messages for select using (true);
create policy "open messages insert" on messages for insert with check (true);

-- Realtime for live chats and the communal Wall.
alter publication supabase_realtime add table wall;
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table users;
