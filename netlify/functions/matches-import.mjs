import { sql } from './_lib/db.mjs';
import { json, readJson, assertMethod, handleError } from './_lib/http.mjs';
import { requireAuth } from './_lib/auth.mjs';
import { fetchRiotMatch } from './_lib/riot.mjs';
import { persistAnalyzedMatch } from './_lib/analytics.mjs';

export default async function handler(request, context) {
  try {
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request);

    const gameId = String(body.gameId || '').trim().toUpperCase();
    const teamId = String(body.teamId || '').trim();

    if (!gameId) throw Object.assign(new Error('Game ID requis.'), { status: 400 });
    if (!teamId) throw Object.assign(new Error('Team ID requis.'), { status: 400 });
    if (!/^([A-Z0-9]+)_\d+$/.test(gameId)) throw Object.assign(new Error('Format Game ID invalide. Exemple : EUW1_7123456789'), { status: 400 });

    const teams = await sql`
      select distinct teams.*
      from teams
      left join team_members on team_members.team_id = teams.id
      where teams.id = ${teamId}
        and (teams.owner_id = ${user.id} or team_members.user_id = ${user.id})
      limit 1
    `;
    const team = teams[0];
    if (!team) throw Object.assign(new Error('Team introuvable ou non autorisée.'), { status: 403 });

    const roster = await sql`select * from players where team_id = ${teamId}`;
    if (!roster.length) throw Object.assign(new Error('Ajoute au moins un joueur au roster avant d’importer une game.'), { status: 400 });

    const match = await fetchRiotMatch(gameId);
    const savedMatch = await persistAnalyzedMatch({ team, gameId, match, roster, userId: user.id });

    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, 'match.import', 'match', ${savedMatch.id}, ${JSON.stringify({ gameId, teamId })}::jsonb)
    `;

    return json({ match: savedMatch });
  } catch (err) {
    return handleError(err);
  }
}
