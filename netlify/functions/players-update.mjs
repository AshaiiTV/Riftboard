import { sql } from './_lib/db.mjs';
import { json, readJson, assertMethod, handleError } from './_lib/http.mjs';
import { requireAuth } from './_lib/auth.mjs';

const STAFF_ROLES = new Set(['COACH', 'ASSISTANT', 'ANALYST', 'MANAGER', 'BOARD']);

export default async function handler(request, context) {
  try {
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request);

    const teamId = String(body.teamId || '').trim();
    const playerId = String(body.playerId || '').trim();
    const name = String(body.name || '').trim();
    let riotId = String(body.riotId || '').trim() || null;
    let opggUrl = String(body.opggUrl || '').trim() || null;

    if (!teamId || !playerId || !name) throw Object.assign(new Error('Team, profil et nom requis.'), { status: 400 });

    const allowed = await sql`
      select teams.id
      from teams
      left join team_members on team_members.team_id = teams.id and team_members.user_id = ${user.id}
      where teams.id = ${teamId}
        and (teams.owner_id = ${user.id} or team_members.role in ('captain', 'coach'))
      limit 1
    `;
    if (!allowed[0]) throw Object.assign(new Error('Seul l’owner, un capitaine ou un coach peut modifier un profil.'), { status: 403 });

    const existing = await sql`
      select id, role
      from players
      where id = ${playerId}
        and team_id = ${teamId}
      limit 1
    `;
    if (!existing[0]) throw Object.assign(new Error('Profil introuvable dans cette team.'), { status: 404 });

    const staffRole = STAFF_ROLES.has(String(existing[0].role || '').toUpperCase());
    if (staffRole) {
      riotId = null;
      opggUrl = null;
    } else if (!riotId) {
      throw Object.assign(new Error('Riot ID requis pour un joueur.'), { status: 400 });
    }

    const rows = await sql`
      update players
      set name = ${name},
          riot_id = ${riotId},
          opgg_url = ${opggUrl},
          updated_at = now()
      where id = ${playerId}
        and team_id = ${teamId}
      returning *
    `;

    await sql`
      update champion_pool
      set player_name = ${name}
      where player_id = ${playerId}
        and team_id = ${teamId}
    `;

    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, 'player.update', 'player', ${playerId}, ${JSON.stringify({ teamId, riotId, role: rows[0].role })}::jsonb)
    `;

    return json({ player: rows[0] });
  } catch (err) {
    if (String(err.message || '').includes('duplicate key')) err.message = 'Ce Riot ID existe déjà dans cette team.';
    return handleError(err);
  }
}
