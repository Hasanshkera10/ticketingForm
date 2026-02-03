create extension if not exists "pgcrypto";

create table if not exists public.it_support_tickets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'open',
  name text not null,
  email text not null,
  department text not null,
  issue_type text not null,
  priority text not null check (priority in ('low', 'medium', 'high', 'critical')),
  description text not null,
  device text not null default '',
  location text not null default ''
);

create index if not exists it_support_tickets_created_at_idx
  on public.it_support_tickets (created_at desc);
