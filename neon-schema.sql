-- Run this whole file once in the Neon SQL editor.

create table if not exists users (
  id text primary key,
  glyphname text unique not null,
  name text not null,
  symbol text not null default '✦',
  created timestamptz not null default now()
);

create table if not exists wall (
  id text primary key,
  kind text not null,
  symbol text not null,
  label text not null,
  note text,
  likes int not null default 0,
  author text not null,
  created timestamptz not null default now()
);

create table if not exists messages (
  id text primary key,
  conv text not null,
  sender text not null,
  text text not null,
  created timestamptz not null default now()
);

create index if not exists wall_created_idx on wall (created desc);
create index if not exists messages_conv_idx on messages (conv, created asc);
