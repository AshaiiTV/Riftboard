import { sql } from './_lib/db.mjs';
import { json, readJson, assertMethod, handleError } from './_lib/http.mjs';
import { requireAuth } from './_lib/auth.mjs';

const STATUSES = new Set(['lock', 'pocket', 'work', 'danger']);
const GAMEPLAY_ROLES = new Set(['TOP', 'JGL', 'MID', 'ADC', 'SUP', 'SUB']);

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

    const member = await sql`
      select team_members.role
      from teams
      left join team_members on team_members.team_id = teams.id and team_members.user_id = ${user.id}
      where teams.id = ${teamId}
        and team_members.user_id = ${user.id}
      limit 1
    `;
    const isCaptain = String(member[0]?.role || '').toLowerCase() === 'captain';

    if (action === 'delete') {
      if (!poolId) throw Object.assign(new Error('Pick requis.'), { status: 400 });
      const target = await sql`
        select champion_pool.*, players.user_id as player_user_id
        from champion_pool
        left join players on players.id = champion_pool.player_id
        where champion_pool.id = ${poolId}
          and champion_pool.team_id = ${teamId}
        limit 1
      `;
      if (!target[0]) throw Object.assign(new Error('Pick introuvable.'), { status: 404 });
      if (!isCaptain && String(target[0].player_user_id || '') !== String(user.id)) {
        throw Object.assign(new Error('Seul le capitaine ou le joueur lié à ce profil peut modifier ce champion pool.'), { status: 403 });
      }
      const deleted = await sql`
        delete from champion_pool
        where id = ${poolId}
          and team_id = ${teamId}
          and source in ('manual', 'riot_manual')
        returning *
      `;
      if (!deleted[0]) throw Object.assign(new Error('Pick introuvable.'), { status: 404 });
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
      select id, name, role, user_id
      from players
      where id = ${playerId}
        and team_id = ${teamId}
      limit 1
    `;
    const player = players[0];
    if (!player) throw Object.assign(new Error('Joueur introuvable dans cette team.'), { status: 404 });
    if (!GAMEPLAY_ROLES.has(String(player.role || '').toUpperCase())) {
      throw Object.assign(new Error('Ce profil staff ne peut pas avoir de Champion Pool.'), { status: 400 });
    }
    if (!isCaptain && String(player.user_id || '') !== String(user.id)) {
      throw Object.assign(new Error('Seul le capitaine ou le joueur lié à ce profil peut modifier ce champion pool.'), { status: 403 });
    }

    const verdict = status === 'lock'
      ? 'Pick prioritaire.'
      : status === 'pocket'
        ? 'Pocket pick.'
        : status === 'danger'
          ? 'Volume élevé, WR faible.'
          : 'Pick à valider.';

    if (poolId) {
      if (!isCaptain) {
        const existing = await sql`
          select player_id
          from champion_pool
          where id = ${poolId}
            and team_id = ${teamId}
          limit 1
        `;
        if (!existing[0]) throw Object.assign(new Error('Pick introuvable.'), { status: 404 });
        if (String(existing[0].player_id || '') !== String(player.id)) {
          throw Object.assign(new Error('Tu ne peux modifier que ton propre Champion Pool.'), { status: 403 });
        }
      }
      const rows = await sql`
        update champion_pool
        set player_id = ${playerId},
            player_name = ${player.name},
            role = ${player.role},
            status = ${status},
            notes = ${notes},
            source = case when source = 'riot' then 'riot_manual' else source end,
            impact_grade = case when source = 'manual' then 'POOL' else impact_grade end,
            verdict = ${verdict},
            updated_at = now()
        where id = ${poolId}
          and team_id = ${teamId}
        returning *
      `;
      if (!rows[0]) throw Object.assign(new Error('Pick introuvable.'), { status: 404 });
      await sql`
        insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        values (${user.id}, 'champion_pool.manual_update', 'champion_pool', ${rows[0].id}, ${JSON.stringify({ teamId, playerId, champion: rows[0].champion, status })}::jsonb)
      `;
      return json({ pick: rows[0] });
    }

    const rows = await sql`
      insert into champion_pool (team_id, player_id, player_name, champion, games, wins, losses, winrate, kda, cs_per_min, impact_grade, verdict, role, status, notes, source, updated_at)
      values (${teamId}, ${playerId}, ${player.name}, ${champion}, 0, 0, 0, 0, 0, 0, 'POOL', ${verdict}, ${player.role}, ${status}, ${notes}, 'manual', now())
      on conflict (team_id, player_id, champion)
      do update set
        player_name = excluded.player_name,
        role = excluded.role,
        games = champion_pool.games,
        wins = champion_pool.wins,
        losses = champion_pool.losses,
        winrate = champion_pool.winrate,
        kda = champion_pool.kda,
        cs_per_min = champion_pool.cs_per_min,
        status = excluded.status,
        notes = excluded.notes,
        source = case when champion_pool.source = 'riot' then 'riot_manual' else 'manual' end,
        impact_grade = 'POOL',
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
