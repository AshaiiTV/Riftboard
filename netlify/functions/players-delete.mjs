import { sql } from './_lib/db.mjs';
import { json, readJson, assertMethod, handleError } from './_lib/http.mjs';
import { requireAuth } from './_lib/auth.mjs';

export default async function handler(request, context) {
  try {
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request);

    const teamId = String(body.teamId || '').trim();
    const playerId = String(body.playerId || '').trim();
    if (!teamId || !playerId) throw Object.assign(new Error('Team et profil Riot requis.'), { status: 400 });

    const allowed = await sql`
      select teams.id
      from teams
      left join team_members on team_members.team_id = teams.id and team_members.user_id = ${user.id}
      where teams.id = ${teamId}
        and (teams.owner_id = ${user.id} or team_members.role in ('captain', 'coach', 'assistant', 'analyst', 'manager', 'board'))
      limit 1
    `;
    if (!allowed[0]) throw Object.assign(new Error('Seul l’owner ou un staff autorisé peut supprimer un profil.'), { status: 403 });

    const rows = await sql`
      delete from players
      where id = ${playerId}
        and team_id = ${teamId}
      returning *
    `;
    if (!rows[0]) throw Object.assign(new Error('Profil Riot introuvable dans cette team.'), { status: 404 });

    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, 'player.delete', 'player', ${playerId}, ${JSON.stringify({ teamId, riotId: rows[0].riot_id })}::jsonb)
    `;

    return json({ ok: true, player: rows[0] });
  } catch (err) {
    return handleError(err);
  }
}
