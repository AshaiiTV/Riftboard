create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  account_name text not null unique,
  email text,
  name text not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migration v16 : conserve un identifiant technique interne pour les anciens comptes.
alter table users add column if not exists account_name text;
update users
set account_name = lower(regexp_replace(coalesce(nullif(name, ''), 'compte') || '-' || substr(id::text, 1, 8), '[^a-z0-9._-]', '', 'g'))
where account_name is null or account_name = '';
alter table users alter column account_name set not null;
create unique index if not exists idx_users_account_name on users(account_name);
alter table users add column if not exists email text;
create unique index if not exists idx_users_email_lower on users (lower(email)) where email is not null and email <> '';

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  user_agent text,
  ip text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_password_reset_tokens_user on password_reset_tokens(user_id);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  name text not null,
  tag text not null,
  region text not null default 'EUW',
  invite_code text,
  invite_expires_at timestamptz,
  avatar_data_url text,
  avatar_zoom numeric not null default 1,
  avatar_x numeric not null default 0,
  avatar_y numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, name)
);

alter table teams add column if not exists invite_code text;
alter table teams add column if not exists invite_expires_at timestamptz;
alter table teams add column if not exists avatar_data_url text;
alter table teams add column if not exists avatar_zoom numeric not null default 1;
alter table teams add column if not exists avatar_x numeric not null default 0;
alter table teams add column if not exists avatar_y numeric not null default 0;
update teams
set invite_code = 'RIFT-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 6))
where invite_code is null;
create unique index if not exists idx_teams_invite_code on teams(invite_code);

create table if not exists team_invite_codes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  created_by uuid references users(id) on delete set null,
  code text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_team_invite_codes_team on team_invite_codes(team_id, expires_at desc);

create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'captain', 'coach', 'analyst', 'player', 'viewer', 'member')),
  created_at timestamptz not null default now(),
  unique(team_id, user_id)
);

insert into team_members (team_id, user_id, role)
select id, owner_id, 'owner'
from teams
on conflict (team_id, user_id) do nothing;

alter table team_members drop constraint if exists team_members_role_check;
alter table team_members add constraint team_members_role_check check (role in ('owner', 'captain', 'coach', 'analyst', 'player', 'viewer', 'member'));

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  name text not null,
  riot_id text,
  opgg_url text,
  role text not null check (role in ('TOP', 'JGL', 'MID', 'ADC', 'SUP', 'SUB', 'COACH')),
  most_played jsonb not null default '[]'::jsonb,
  performance_score numeric,
  status text default 'Non analysé',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(team_id, riot_id)
);

alter table players add column if not exists user_id uuid references users(id) on delete set null;
alter table players alter column riot_id drop not null;
alter table players add column if not exists most_played jsonb not null default '[]'::jsonb;
alter table players drop constraint if exists players_role_check;
alter table players add constraint players_role_check check (role in ('TOP', 'JGL', 'MID', 'ADC', 'SUP', 'SUB', 'COACH'));

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  game_id text not null,
  region text not null default 'EUROPE',
  opponent text,
  result text check (result in ('Victoire', 'Défaite', 'Analyse')),
  side text check (side in ('Blue Side', 'Red Side')),
  duration_seconds integer,
  duration text,
  patch text,
  objective_score text,
  vision_score text,
  impact_score text,
  primary_focus text,
  main_issue text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(team_id, game_id)
);

create table if not exists match_participants (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  player_id uuid references players(id) on delete set null,
  team_key text not null check (team_key in ('ALLY', 'ENEMY')),
  summoner_name text,
  riot_id text,
  champion text not null,
  role text,
  kills integer not null default 0,
  deaths integer not null default 0,
  assists integer not null default 0,
  cs integer not null default 0,
  gold integer not null default 0,
  damage integer not null default 0,
  vision integer not null default 0,
  kp numeric,
  kda text,
  cs_per_min numeric,
  gold_per_min numeric,
  kill_participation text,
  grade text,
  raw jsonb not null default '{}'::jsonb
);

create table if not exists match_raw_archives (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  match_id uuid references matches(id) on delete cascade,
  game_id text not null,
  source text not null default 'import',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(team_id, game_id)
);

create table if not exists match_archives (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  created_by uuid references users(id) on delete set null,
  name text not null,
  description text,
  match_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists champion_pool (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  player_name text not null,
  champion text not null,
  games integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  winrate numeric not null default 0,
  kda numeric not null default 0,
  cs_per_min numeric not null default 0,
  impact_grade text not null default '—',
  verdict text not null default 'Données insuffisantes',
  updated_at timestamptz not null default now(),
  unique(team_id, player_id, champion)
);

create table if not exists improvements (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  rank integer not null,
  title text not null,
  severity text not null default 'medium',
  proof text not null,
  action text not null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  match_id uuid references matches(id) on delete set null,
  match_ids jsonb not null default '[]'::jsonb,
  created_by uuid references users(id) on delete set null,
  title text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists composition_types (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  created_by uuid references users(id) on delete set null,
  title text not null,
  notes text,
  tags jsonb not null default '[]'::jsonb,
  slots jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tournament_codes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  created_by uuid references users(id) on delete set null,
  label text not null,
  opponent text,
  code text not null,
  platform text not null default 'EUW1',
  status text not null default 'ready',
  match_id uuid references matches(id) on delete set null,
  imported_game_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists player_availability (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  week_start date not null default date_trunc('week', current_date)::date,
  slots jsonb not null default '{}'::jsonb,
  notes text,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(team_id, player_id, week_start)
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_sessions_token_hash on sessions(token_hash);
create index if not exists idx_teams_owner on teams(owner_id);
create index if not exists idx_team_members_user on team_members(user_id);
create index if not exists idx_team_members_team on team_members(team_id);
create index if not exists idx_players_team on players(team_id);
create index if not exists idx_matches_team on matches(team_id, created_at desc);
create index if not exists idx_participants_match on match_participants(match_id);
create index if not exists idx_match_raw_archives_team on match_raw_archives(team_id, created_at desc);
create index if not exists idx_match_archives_team on match_archives(team_id, created_at desc);
alter table champion_pool add column if not exists role text;
alter table champion_pool add column if not exists status text not null default 'work';
alter table champion_pool add column if not exists notes text;
alter table champion_pool add column if not exists source text not null default 'riot';

create index if not exists idx_champion_pool_team on champion_pool(team_id);
create index if not exists idx_improvements_team on improvements(team_id, rank asc);
create index if not exists idx_reports_team on reports(team_id, created_at desc);
alter table reports add column if not exists match_ids jsonb not null default '[]'::jsonb;
alter table reports add column if not exists created_by uuid references users(id) on delete set null;
alter table reports add column if not exists updated_at timestamptz not null default now();
alter table composition_types add column if not exists tags jsonb not null default '[]'::jsonb;
alter table player_availability add column if not exists week_start date not null default date_trunc('week', current_date)::date;
alter table player_availability drop constraint if exists player_availability_team_id_player_id_key;
create index if not exists idx_composition_types_team on composition_types(team_id, created_at desc);
create index if not exists idx_tournament_codes_team on tournament_codes(team_id, created_at desc);
create unique index if not exists idx_tournament_codes_team_code on tournament_codes(team_id, code);
create index if not exists idx_player_availability_team on player_availability(team_id);
create unique index if not exists idx_player_availability_week on player_availability(team_id, player_id, week_start);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_users_updated_at on users;
create trigger trg_users_updated_at before update on users
for each row execute function set_updated_at();

drop trigger if exists trg_teams_updated_at on teams;
create trigger trg_teams_updated_at before update on teams
for each row execute function set_updated_at();

drop trigger if exists trg_players_updated_at on players;
create trigger trg_players_updated_at before update on players
for each row execute function set_updated_at();

drop trigger if exists trg_composition_types_updated_at on composition_types;
create trigger trg_composition_types_updated_at before update on composition_types
for each row execute function set_updated_at();

drop trigger if exists trg_player_availability_updated_at on player_availability;
create trigger trg_player_availability_updated_at before update on player_availability
for each row execute function set_updated_at();

drop trigger if exists trg_reports_updated_at on reports;
create trigger trg_reports_updated_at before update on reports
for each row execute function set_updated_at();

drop trigger if exists trg_match_archives_updated_at on match_archives;
create trigger trg_match_archives_updated_at before update on match_archives
for each row execute function set_updated_at();

drop trigger if exists trg_tournament_codes_updated_at on tournament_codes;
create trigger trg_tournament_codes_updated_at before update on tournament_codes
for each row execute function set_updated_at();
