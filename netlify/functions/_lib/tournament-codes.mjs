import { sql } from './db.mjs';

let tableReadyPromise = null;

export function cleanTournamentText(value, max = 240) {
  return String(value || '').trim().slice(0, max);
}

export async function ensureTournamentCodesTable() {
  if (!tableReadyPromise) {
    tableReadyPromise = (async () => {
      await sql`
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
        )
      `;
      await sql`create index if not exists tournament_codes_team_idx on tournament_codes(team_id, created_at desc)`;
      await sql`create unique index if not exists tournament_codes_team_code_idx on tournament_codes(team_id, code)`;
    })().catch((error) => {
      tableReadyPromise = null;
      throw error;
    });
  }
  return tableReadyPromise;
}

export async function canManageTournamentCodes(userId, teamId) {
  const rows = await sql`
    select teams.owner_id, team_members.role
    from teams
    left join team_members on team_members.team_id = teams.id and team_members.user_id = ${userId}
    where teams.id = ${teamId}
      and (teams.owner_id = ${userId} or team_members.user_id = ${userId})
    limit 1
  `;
  const member = rows[0];
  if (!member) return false;
  return member.owner_id === userId || ['captain', 'coach', 'assistant', 'analyst', 'manager', 'board'].includes(String(member.role || '').toLowerCase());
}
