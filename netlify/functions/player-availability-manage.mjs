import { sql } from './_lib/db.mjs';
import { json, readJson, assertMethod, handleError } from './_lib/http.mjs';
import { requireAuth } from './_lib/auth.mjs';

const VALID_DAYS = new Set(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);
const VALID_TIMES = new Set(['18:00', '19:00', '20:00', '21:00', '22:00', '23:00']);

function cleanSlots(value) {
  const input = value && typeof value === 'object' ? value : {};
  const output = {};
  for (const day of VALID_DAYS) {
    const times = Array.isArray(input[day]) ? input[day] : [];
    output[day] = [...new Set(times.filter((time) => VALID_TIMES.has(String(time))))];
  }
  return output;
}

async function ensureAvailabilityTable() {
  await sql`
    create table if not exists player_availability (
      id uuid primary key default gen_random_uuid(),
      team_id uuid not null references teams(id) on delete cascade,
      player_id uuid not null references players(id) on delete cascade,
      slots jsonb not null default '{}'::jsonb,
      notes text,
      updated_by uuid references users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(team_id, player_id)
    )
  `;
  await sql`create index if not exists idx_player_availability_team on player_availability(team_id)`;
}

export default async function handler(request, context) {
  try {
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    await ensureAvailabilityTable();
    const body = await readJson(request);
    const teamId = String(body.teamId || '').trim();
    const playerId = String(body.playerId || '').trim();
    const slots = cleanSlots(body.slots);
    const notes = String(body.notes || '').trim().slice(0, 500) || null;

    if (!teamId || !playerId) throw Object.assign(new Error('Team et profil requis.'), { status: 400 });

    const playerRows = await sql`
      select players.*
      from players
      where players.id = ${playerId}
        and players.team_id = ${teamId}
      limit 1
    `;
    const player = playerRows[0];
    if (!player) throw Object.assign(new Error('Profil introuvable.'), { status: 404 });

    const memberRows = await sql`
      select teams.owner_id, team_members.role
      from teams
      left join team_members on team_members.team_id = teams.id and team_members.user_id = ${user.id}
      where teams.id = ${teamId}
      limit 1
    `;
    const member = memberRows[0];
    const role = String(member?.role || '').toLowerCase();
    const canManage = member?.owner_id === user.id || ['owner', 'captain', 'coach'].includes(role);
    const ownsProfile = player.user_id && player.user_id === user.id;
    if (!canManage && !ownsProfile) {
      throw Object.assign(new Error('Tu peux modifier uniquement tes disponibilités, sauf capitaine ou coach.'), { status: 403 });
    }

    const rows = await sql`
      insert into player_availability (team_id, player_id, slots, notes, updated_by)
      values (${teamId}, ${playerId}, ${JSON.stringify(slots)}::jsonb, ${notes}, ${user.id})
      on conflict (team_id, player_id)
      do update set
        slots = excluded.slots,
        notes = excluded.notes,
        updated_by = excluded.updated_by,
        updated_at = now()
      returning *
    `;

    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, 'player_availability.upsert', 'player', ${playerId}, ${JSON.stringify({ teamId })}::jsonb)
    `;

    return json({ availability: rows[0] });
  } catch (err) {
    return handleError(err);
  }
}
