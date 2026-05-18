import { sql } from './_lib/db.mjs';
import { json, readJson, assertMethod, handleError } from './_lib/http.mjs';
import { requireAuth } from './_lib/auth.mjs';

const STAFF_ROLES = new Set(['COACH', 'ASSISTANT', 'ANALYST', 'MANAGER', 'BOARD']);
const ROLES = new Set(['TOP', 'JGL', 'MID', 'ADC', 'SUP', 'SUB', ...STAFF_ROLES]);

export default async function handler(request, context) {
  try {
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request);

    const teamId = String(body.teamId || '').trim();
    const name = String(body.name || '').trim();
    let riotId = String(body.riotId || '').trim() || null;
    let opggUrl = String(body.opggUrl || '').trim() || null;
    const role = String(body.role || '').trim().toUpperCase();
    const staffRole = STAFF_ROLES.has(role);

    if (!teamId || !name) throw Object.assign(new Error('Team et nom requis.'), { status: 400 });
    if (!ROLES.has(role)) throw Object.assign(new Error('Rôle invalide.'), { status: 400 });
    if (!staffRole && !riotId) throw Object.assign(new Error('Riot ID requis pour un joueur.'), { status: 400 });
    if (staffRole) {
      riotId = null;
      opggUrl = null;
    }

    const allowed = await sql`
      select teams.id
      from teams
      left join team_members on team_members.team_id = teams.id and team_members.user_id = ${user.id}
      where teams.id = ${teamId}
        and (teams.owner_id = ${user.id} or team_members.role in ('captain', 'coach'))
      limit 1
    `;
    if (!allowed[0]) throw Object.assign(new Error('Seul l’owner, un capitaine ou un coach peut ajouter un profil.'), { status: 403 });

    const rows = await sql`
      insert into players (team_id, name, riot_id, opgg_url, role)
      values (${teamId}, ${name}, ${riotId}, ${opggUrl}, ${role})
      returning *
    `;

    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, 'player.create', 'player', ${rows[0].id}, ${JSON.stringify({ teamId, riotId, role })}::jsonb)
    `;

    return json({ player: rows[0] });
  } catch (err) {
    if (String(err.message || '').includes('duplicate key')) err.message = 'Ce Riot ID existe déjà dans cette team.';
    return handleError(err);
  }
}
