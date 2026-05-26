import { sql } from './_lib/db.mjs';
import { json, readJson, assertMethod, handleError } from './_lib/http.mjs';
import { requireAuth } from './_lib/auth.mjs';

export default async function handler(request, context) {
  try {
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request);

    const teamId = String(body.teamId || '').trim();
    const userId = String(body.userId || '').trim();
    if (!teamId || !userId) throw Object.assign(new Error('Team et profil requis.'), { status: 400 });

    const allowed = await sql`
      select teams.id
      from teams
      left join team_members on team_members.team_id = teams.id and team_members.user_id = ${user.id}
      where teams.id = ${teamId}
        and (teams.owner_id = ${user.id} or team_members.role in ('captain', 'coach', 'assistant', 'analyst', 'manager', 'board'))
      limit 1
    `;
    if (!allowed[0]) throw Object.assign(new Error('Seul l’owner ou un staff autorisé peut renvoyer un profil.'), { status: 403 });
    if (userId === user.id) throw Object.assign(new Error('Tu ne peux pas te renvoyer toi-même.'), { status: 400 });

    const target = await sql`
      select role
      from team_members
      where team_id = ${teamId}
        and user_id = ${userId}
      limit 1
    `;
    if (target[0]?.role === 'owner') throw Object.assign(new Error('Le compte owner ne peut pas être renvoyé de sa team.'), { status: 400 });

    const rows = await sql`
      delete from team_members
      where team_id = ${teamId}
        and user_id = ${userId}
      returning *
    `;
    if (!rows[0]) throw Object.assign(new Error('Profil introuvable dans cette team.'), { status: 404 });

    await sql`
      update players
      set user_id = null,
          updated_at = now()
      where team_id = ${teamId}
        and user_id = ${userId}
    `;

    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, 'team_member.remove', 'team', ${teamId}, ${JSON.stringify({ targetUserId: userId })}::jsonb)
    `;

    return json({ ok: true, member: rows[0] });
  } catch (err) {
    return handleError(err);
  }
}
