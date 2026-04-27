import { sql } from './_lib/db.mjs';
import { json, readJson, assertMethod, handleError } from './_lib/http.mjs';
import { requireAuth } from './_lib/auth.mjs';
import {
  fetchAccountByRiotId,
  fetchMatchIdsByPuuid,
  fetchRiotMatchById,
  fetchTopChampionMastery,
  getChampionDataMap,
  platformFromRegion
} from './_lib/riot.mjs';

function normalizeMastery(row, championData) {
  const championId = Number(row.championId);
  const champion = championData.get(championId);
  const points = Number(row.championPoints || 0);
  return {
    championId,
    champion: champion?.name || `Champion ${championId}`,
    imageUrl: champion?.imageUrl || null,
    points,
    level: Number(row.championLevel || 0),
    lastPlayTime: row.lastPlayTime || null
  };
}

function currentSeasonStartTimestamp() {
  return Math.floor(Date.UTC(new Date().getUTCFullYear(), 0, 1) / 1000);
}

function normalizeMatchStats(stats, championData) {
  return [...stats.values()]
    .sort((a, b) => b.games - a.games || b.wins - a.wins)
    .slice(0, 5)
    .map((item) => {
      const champion = championData.get(Number(item.championId));
      const winrate = item.games ? Math.round((item.wins / item.games) * 100) : 0;
      return {
        championId: Number(item.championId),
        champion: champion?.name || item.championName || `Champion ${item.championId}`,
        imageUrl: champion?.imageUrl || null,
        games: item.games,
        wins: item.wins,
        losses: item.games - item.wins,
        winrate,
        points: item.games,
        source: 'match_history'
      };
    });
}

async function fetchCurrentSeasonMostPlayed(puuid, platform, championData) {
  const matchIds = await fetchMatchIdsByPuuid(puuid, platform, { startTime: currentSeasonStartTimestamp(), count: 20 });
  const stats = new Map();

  for (const matchId of matchIds) {
    const match = await fetchRiotMatchById(matchId, platform);
    const participant = match?.info?.participants?.find((row) => row.puuid === puuid);
    if (!participant?.championId) continue;
    const key = Number(participant.championId);
    const current = stats.get(key) || { championId: key, championName: participant.championName, games: 0, wins: 0 };
    current.games += 1;
    if (participant.win) current.wins += 1;
    stats.set(key, current);
  }

  return normalizeMatchStats(stats, championData);
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
    await sql`alter table champion_pool add column if not exists role text`;
    await sql`alter table champion_pool add column if not exists status text not null default 'work'`;
    await sql`alter table champion_pool add column if not exists notes text`;
    await sql`alter table champion_pool add column if not exists source text not null default 'riot'`;

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
    const championData = await getChampionDataMap();
    const results = [];

    for (const player of players) {
      try {
        if (player.role === 'COACH' || !player.riot_id) {
          await sql`
            update players
            set status = ${player.role === 'COACH' ? 'Coach sans Riot ID' : 'Riot ID manquant'},
                updated_at = now()
            where id = ${player.id}
          `;
          results.push({ playerId: player.id, riotId: player.riot_id, ok: true, skipped: true, reason: player.role === 'COACH' ? 'Coach sans Riot ID' : 'Riot ID manquant' });
          continue;
        }

        const account = await fetchAccountByRiotId(player.riot_id, platform);
        let mostPlayed = [];
        let syncSource = 'match_history';
        try {
          mostPlayed = await fetchCurrentSeasonMostPlayed(account.puuid, platform, championData);
          if (!mostPlayed.length) throw new Error('Aucun match trouve sur la saison courante.');
        } catch (historyErr) {
          const mastery = await fetchTopChampionMastery(account.puuid, platform, 5);
          mostPlayed = mastery.map((row) => normalizeMastery(row, championData));
          syncSource = 'mastery';
        }

        const totalPoints = mostPlayed.reduce((sum, item) => sum + Number(item.points || 0), 0);
        await sql`
          update players
          set most_played = ${JSON.stringify(mostPlayed)}::jsonb,
              performance_score = ${totalPoints || null},
              status = ${mostPlayed.length ? 'Most played synchronisés' : 'Aucune maîtrise trouvée'},
              updated_at = now()
          where id = ${player.id}
        `;

        let poolCount = 0;
        for (const [index, champion] of mostPlayed.entries()) {
          const status = index === 0 ? 'lock' : index < 3 ? 'pocket' : 'work';
          const verdict = syncSource === 'match_history' ? (index === 0 ? 'Champion principal de la saison courante.' : 'Champion recurrent sur la saison courante.') : (index === 0 ? 'Champion principal detecte via Riot Mastery.' : 'Champion recurrent detecte via Riot Mastery.');
          await sql`
            insert into champion_pool (
              team_id,
              player_id,
              player_name,
              champion,
              games,
              wins,
              losses,
              winrate,
              kda,
              cs_per_min,
              impact_grade,
              verdict,
              role,
              status,
              notes,
              source,
              updated_at
            )
            values (
              ${teamId},
              ${player.id},
              ${player.name},
              ${champion.champion},
              ${Number(champion.games || 0)},
              ${Number(champion.wins || 0)},
              ${Number(champion.losses || 0)},
              ${Number(champion.winrate || 0)},
              0,
              0,
              ${syncSource === 'match_history' ? 'SAISON' : 'MASTERY'},
              ${verdict},
              ${player.role},
              ${status},
              ${champion.games ? `${champion.games} games saison courante` : `${champion.points || 0} mastery points`},
              ${syncSource},
              now()
            )
            on conflict (team_id, player_id, champion) do update
            set player_name = excluded.player_name,
                role = excluded.role,
                impact_grade = case when champion_pool.source in ('manual', 'riot_manual') then champion_pool.impact_grade else excluded.impact_grade end,
                verdict = case when champion_pool.source in ('manual', 'riot_manual') then champion_pool.verdict else excluded.verdict end,
                status = case when champion_pool.source in ('manual', 'riot_manual') then champion_pool.status else excluded.status end,
                notes = case when champion_pool.source in ('manual', 'riot_manual') then champion_pool.notes else excluded.notes end,
                source = case when champion_pool.source in ('manual', 'riot_manual') then 'riot_manual' else excluded.source end,
                updated_at = now()
          `;
          poolCount += 1;
        }

        results.push({ playerId: player.id, riotId: player.riot_id, ok: true, mostPlayed, poolCount, source: syncSource });
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
