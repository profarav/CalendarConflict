-- Calendar Conflict Checker — Supabase Schema
-- Run this in the Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users table
create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- Google OAuth connections (one per Google account per user)
create table if not exists google_connections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade not null,
  google_email text not null,
  access_token text not null,
  refresh_token text not null,
  token_expiry timestamptz,
  created_at timestamptz default now(),
  unique (user_id, google_email)
);

-- Calendar report settings (one per user)
create table if not exists calendar_report_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade not null unique,

  calendar_1_connection_id uuid references google_connections(id) on delete cascade not null,
  calendar_1_id text not null,
  calendar_1_name text,

  calendar_2_connection_id uuid references google_connections(id) on delete cascade not null,
  calendar_2_id text not null,
  calendar_2_name text,

  recipient_email text not null,

  report_day text not null check (report_day in ('friday', 'monday')),
  report_hour integer default 8,
  timezone text default 'America/Chicago',

  active boolean default true,

  last_test_sent_at timestamptz,
  last_report_sent_at timestamptz,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS policies (service role bypasses these, but protect against direct client access)
alter table users enable row level security;
alter table google_connections enable row level security;
alter table calendar_report_settings enable row level security;

-- No direct client access needed; all access goes through Next.js API routes
-- using the service role key (server-side only)
