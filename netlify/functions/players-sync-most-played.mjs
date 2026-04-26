import { sql } from './_lib/db.mjs';
import { json, readJson, assertMethod, handleError } from './_lib/http.mjs';
import { requireAuth } from './_lib/auth.mjs';
import {
  fetchAccountByRiotId,
  fetchTopChampionMastery,
  getChampionNameMap,
  platformFromRegion
} from './_lib/riot.mjs';

function normalizeMastery(row, championNames) {
  const championId = Number(row.championId);
  const points = Number(row.championPoints || 0);
  return {
    championId,
    champion: championNames.get(championId) || `Champion ${championId}`,
    points,
    level: Number(row.championLevel || 0),
    lastPlayTime: row.lastPlayTime || null
  };
}

export default async function handler(request, context) {
  try {
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request);

    const teamId = String(body.teamId || '').trim();
    if (!teamId) throw Object.assign(new Error('Team ID requis.'), { status: 400 });

    await sql`
      alter table players
      add column if not exists most_played jsonb not null default '[]'::jsonb
    `;

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

    const players = await sql`select * from players where team_id = ${teamId} order by created_at asc`;
    if (!players.length) throw Object.assign(new Error('Ajoute au moins un joueur avant de synchroniser les most played.'), { status: 400 });

    const platform = platformFromRegion(team.region);
    const championNames = await getChampionNameMap();
    const results = [];

    for (const player of players) {
      try {
        const account = await fetchAccountByRiotId(player.riot_id, platform);
        const mastery = await fetchTopChampionMastery(account.puuid, platform, 5);
        const mostPlayed = mastery.map((row) => normalizeMastery(row, championNames));

        const totalPoints = mostPlayed.reduce((sum, item) => sum + item.points, 0);
        await sql`
          update players
          set most_played = ${JSON.stringify(mostPlayed)}::jsonb,
              performance_score = ${totalPoints || null},
              status = ${mostPlayed.length ? 'Most played synchronisés' : 'Aucune maîtrise trouvée'},
              updated_at = now()
          where id = ${player.id}
        `;

        results.push({ playerId: player.id, riotId: player.riot_id, ok: true, mostPlayed });
      } catch (err) {
        await sql`
          update players
          set status = ${err.message || 'Analyse Riot impossible'},
              updated_at = now()
          where id = ${player.id}
        `;
        results.push({ playerId: player.id, riotId: player.riot_id, ok: false, error: err.message || 'Analyse impossible' });
      }
    }

    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, 'players.sync_most_played', 'team', ${teamId}, ${JSON.stringify({ count: players.length, platform })}::jsonb)
    `;

    return json({ results });
  } catch (err) {
    return handleError(err);
  }
}
