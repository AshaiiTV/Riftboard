import { sql } from './_lib/db.mjs';
import { json, readJson, assertMethod, handleError } from './_lib/http.mjs';
import { requireAuth } from './_lib/auth.mjs';

const STATUSES = new Set(['lock', 'pocket', 'work', 'danger']);

function cleanText(value, max = 120) {
  return String(value || '').trim().slice(0, max);
}

export default async function handler(request, context) {
  try {
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request);

    const action = cleanText(body.action || 'upsert', 20);
    const teamId = cleanText(body.teamId, 80);
    const playerId = cleanText(body.playerId, 80);
    const champion = cleanText(body.champion, 80);
    const status = cleanText(body.status || 'work', 20);
    const notes = cleanText(body.notes, 240) || null;
    const poolId = cleanText(body.poolId, 80);

    if (!teamId) throw Object.assign(new Error('Team requise.'), { status: 400 });

    await sql`alter table champion_pool add column if not exists role text`;
    await sql`alter table champion_pool add column if not exists status text not null default 'work'`;
    await sql`alter table champion_pool add column if not exists notes text`;
    await sql`alter table champion_pool add column if not exists source text not null default 'riot'`;

    const allowed = await sql`
      select teams.id
      from teams
      left join team_members on team_members.team_id = teams.id and team_members.user_id = ${user.id}
      where teams.id = ${teamId}
        and (teams.owner_id = ${user.id} or team_members.role in ('captain', 'coach'))
      limit 1
    `;
    if (!allowed[0]) throw Object.assign(new Error('Seul un capitaine ou coach peut modifier le champion pool.'), { status: 403 });

    if (action === 'delete') {
      if (!poolId) throw Object.assign(new Error('Pick requis.'), { status: 400 });
      const deleted = await sql`
        delete from champion_pool
        where id = ${poolId}
          and team_id = ${teamId}
          and source in ('manual', 'riot_manual')
        returning *
      `;
      if (!deleted[0]) throw Object.assign(new Error('Pick manuel introuvable.'), { status: 404 });
      if (deleted[0].source === 'riot_manual') {
        await sql`
          insert into champion_pool (id, team_id, player_id, player_name, champion, games, wins, losses, winrate, kda, cs_per_min, impact_grade, verdict, role, status, notes, source, updated_at)
          values (${deleted[0].id}, ${deleted[0].team_id}, ${deleted[0].player_id}, ${deleted[0].player_name}, ${deleted[0].champion}, ${deleted[0].games}, ${deleted[0].wins}, ${deleted[0].losses}, ${deleted[0].winrate}, ${deleted[0].kda}, ${deleted[0].cs_per_min}, ${deleted[0].impact_grade}, ${deleted[0].verdict}, ${deleted[0].role}, 'work', null, 'riot', now())
        `;
      }
      await sql`
        insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        values (${user.id}, 'champion_pool.manual_delete', 'champion_pool', ${poolId}, ${JSON.stringify({ teamId, champion: deleted[0].champion })}::jsonb)
      `;
      return json({ ok: true, pick: deleted[0] });
    }

    if (!playerId || !champion) throw Object.assign(new Error('Joueur et champion requis.'), { status: 400 });
    if (!STATUSES.has(status)) throw Object.assign(new Error('Statut de pick invalide.'), { status: 400 });

    const players = await sql`
      select id, name, role
      from players
      where id = ${playerId}
        and team_id = ${teamId}
      limit 1
    `;
    const player = players[0];
    if (!player) throw Object.assign(new Error('Joueur introuvable dans cette team.'), { status: 404 });

    const verdict = status === 'lock'
      ? 'Pick manuel prioritaire.'
      : status === 'pocket'
        ? 'Pocket pick manuel.'
        : status === 'danger'
          ? 'Pick manuel à retravailler.'
          : 'Pick manuel à valider.';

    const rows = await sql`
      insert into champion_pool (team_id, player_id, player_name, champion, games, wins, losses, winrate, kda, cs_per_min, impact_grade, verdict, role, status, notes, source, updated_at)
      values (${teamId}, ${playerId}, ${player.name}, ${champion}, 0, 0, 0, 0, 0, 0, 'MANUAL', ${verdict}, ${player.role}, ${status}, ${notes}, 'manual', now())
      on conflict (team_id, player_id, champion)
      do update set
        player_name = excluded.player_name,
        role = excluded.role,
        status = excluded.status,
        notes = excluded.notes,
        source = case when champion_pool.source = 'riot' then 'riot_manual' else 'manual' end,
        impact_grade = case when champion_pool.source = 'riot' then champion_pool.impact_grade else 'MANUAL' end,
        verdict = excluded.verdict,
        updated_at = now()
      returning *
    `;

    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, 'champion_pool.manual_upsert', 'champion_pool', ${rows[0].id}, ${JSON.stringify({ teamId, playerId, champion, status })}::jsonb)
    `;

    return json({ pick: rows[0] });
  } catch (err) {
    return handleError(err);
  }
}
