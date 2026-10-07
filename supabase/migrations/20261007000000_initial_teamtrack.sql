-- TeamTrack's first server-side data model. Run with Supabase migrations.
create extension if not exists pgcrypto;

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  sport text not null check (sport in ('soccer', 'football')),
  coed boolean not null default false,
  min_girls_on_field integer check (min_girls_on_field between 1 and 50),
  profile_picture text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, sport),
  check (sport = 'soccer' or (coed = false and min_girls_on_field is null))
);

create table public.roster_players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  jersey_number integer check (jersey_number between 0 and 999),
  gender text check (gender in ('girl', 'boy', 'other', 'unspecified')),
  position text not null check (length(btrim(position)) between 1 and 80),
  availability text not null default 'active' check (availability in ('active', 'unavailable')),
  profile_picture text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, team_id)
);

create table public.lineups (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  sport text not null check (sport in ('soccer', 'football')),
  name text not null check (length(btrim(name)) between 1 and 120),
  formation text not null check (length(btrim(formation)) between 1 and 120),
  player_count integer not null check (player_count between 1 and 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (team_id, sport) references public.teams(id, sport) on delete cascade,
  unique (id, team_id)
);

create table public.lineup_players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  lineup_id uuid not null,
  player_id uuid not null,
  position text not null check (length(btrim(position)) between 1 and 80),
  x numeric(6,3),
  y numeric(6,3),
  is_starter boolean not null default true,
  foreign key (lineup_id, team_id) references public.lineups(id, team_id) on delete cascade,
  foreign key (player_id, team_id) references public.roster_players(id, team_id) on delete cascade,
  unique (lineup_id, player_id),
  check ((is_starter and x between 0 and 100 and y between 0 and 100)
      or (not is_starter and x is null and y is null))
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  opponent text not null check (length(btrim(opponent)) between 1 and 120),
  match_date timestamptz not null,
  location text,
  team_score integer not null default 0 check (team_score >= 0),
  opponent_score integer not null default 0 check (opponent_score >= 0),
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'completed', 'cancelled')),
  lineup_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (lineup_id, team_id) references public.lineups(id, team_id) on delete set null (lineup_id),
  unique (id, team_id)
);

create table public.player_statistics (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  match_id uuid not null,
  player_id uuid not null,
  minutes_played numeric(8,2) not null default 0 check (minutes_played >= 0),
  minutes_benched numeric(8,2) not null default 0 check (minutes_benched >= 0),
  goals integer not null default 0 check (goals >= 0),
  assists integer not null default 0 check (assists >= 0),
  yellow_cards integer not null default 0 check (yellow_cards >= 0),
  red_cards integer not null default 0 check (red_cards >= 0),
  substitutions_in integer not null default 0 check (substitutions_in >= 0),
  substitutions_out integer not null default 0 check (substitutions_out >= 0),
  foreign key (match_id, team_id) references public.matches(id, team_id) on delete cascade,
  foreign key (player_id, team_id) references public.roster_players(id, team_id) on delete cascade,
  unique (match_id, player_id)
);

create table public.match_events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  match_id uuid not null,
  event_type text not null check (event_type in ('goal', 'assist', 'yellow_card', 'red_card', 'substitution')),
  event_second integer not null check (event_second >= 0),
  player_id uuid,
  related_player_id uuid,
  note text,
  created_at timestamptz not null default now(),
  foreign key (match_id, team_id) references public.matches(id, team_id) on delete cascade,
  foreign key (player_id, team_id) references public.roster_players(id, team_id) on delete set null (player_id),
  foreign key (related_player_id, team_id) references public.roster_players(id, team_id) on delete set null (related_player_id),
  check (event_type <> 'substitution' or (player_id is not null and related_player_id is not null and player_id <> related_player_id))
);

create index teams_owner_idx on public.teams(owner_user_id);
create index roster_players_team_idx on public.roster_players(team_id);
create index lineups_team_idx on public.lineups(team_id);
create index lineup_players_lineup_idx on public.lineup_players(lineup_id);
create index matches_team_date_idx on public.matches(team_id, match_date desc);
create index matches_lineup_idx on public.matches(lineup_id) where lineup_id is not null;
create index player_statistics_player_idx on public.player_statistics(player_id);
create index match_events_match_time_idx on public.match_events(match_id, event_second);

-- Ownership is the initial authorization model. Team membership can replace
-- this helper in a later migration without rewriting each child policy.
create function public.can_access_team(requested_team_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.teams t
    where t.id = requested_team_id and t.owner_user_id = (select auth.uid()));
$$;
revoke all on function public.can_access_team(uuid) from public;
grant execute on function public.can_access_team(uuid) to authenticated;

alter table public.teams enable row level security;
create policy teams_owner on public.teams for all to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

do $$
declare table_name text;
begin
  foreach table_name in array array['roster_players', 'lineups', 'lineup_players',
    'matches', 'player_statistics', 'match_events'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy team_owner on public.%I for all to authenticated using (public.can_access_team(team_id)) with check (public.can_access_team(team_id))', table_name);
  end loop;
end $$;
