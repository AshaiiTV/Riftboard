import { sql } from './_lib/db.mjs';
import { json, readJson, assertMethod, handleError } from './_lib/http.mjs';
import { requireAuth } from './_lib/auth.mjs';
import {
  fetchAccountByRiotId,
  fetchMatchIdsByPuuid,
  fetchRiotMatchById,
  getChampionDataMap,
  platformFromRegion
} from './_lib/riot.mjs';

const STAFF_ROLES = new Set(['COACH', 'ASSISTANT', 'ANALYST', 'MANAGER', 'BOARD']);
const RANKED_SOLO_QUEUE = 420;
const MATCH_PAGE_SIZE = 80;
const MATCH_FETCH_CONCURRENCY = 10;
const DEFAULT_PROFILE_SYNC_MAX_MATCHES = 80;

function profileSyncMaxMatches() {
  const value = Number(process.env.RIOT_PROFILE_SYNC_MAX_MATCHES || DEFAULT_PROFILE_SYNC_MAX_MATCHES);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_PROFILE_SYNC_MAX_MATCHES;
  return Math.min(Math.floor(value), 1000);
}

function currentSeasonStartTimestamp() {
  return Math.floor(Date.UTC(new Date().getUTCFullYear(), 0, 1) / 1000);
}

async function mapLimited(items, limit, mapper) {
  const output = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      output[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return output;
}

function normalizeMatchStats(stats, championData) {
  return [...stats.values()]
    .sort((a, b) => b.games - a.games || b.wins - a.wins)
    .slice(0, 3)
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

async function fetchCurrentSeasonSoloqMatchIds(puuid, platform) {
  const startTime = currentSeasonStartTimestamp();
  const maxMatches = profileSyncMaxMatches();
  const matchIds = [];

  for (let start = 0; start < maxMatches; start += MATCH_PAGE_SIZE) {
    const count = Math.min(MATCH_PAGE_SIZE, maxMatches - start);
    const page = await fetchMatchIdsByPuuid(puuid, platform, { startTime, queue: RANKED_SOLO_QUEUE, start, count });
    matchIds.push(...page);
    if (page.length < count) break;
  }

  return matchIds;
}

async function fetchCurrentSeasonSoloqMostPlayed(puuid, platform, championData) {
  const matchIds = await fetchCurrentSeasonSoloqMatchIds(puuid, platform);
  const stats = new Map();

  await mapLimited(matchIds, MATCH_FETCH_CONCURRENCY, async (matchId) => {
    try {
      const match = await fetchRiotMatchById(matchId, platform);
      const participant = match?.info?.participants?.find((row) => row.puuid === puuid);
      if (!participant?.championId) return;
      const key = Number(participant.championId);
      const current = stats.get(key) || { championId: key, championName: participant.championName, games: 0, wins: 0 };
      current.games += 1;
      if (participant.win) current.wins += 1;
      stats.set(key, current);
    } catch {
      // Keep the season signal honest: a failed match fetch is ignored, never replaced by mastery.
    }
  });

  return normalizeMatchStats(stats, championData);
}

export default async function handler(request, context) {
  try {
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request);

    const teamId = String(body.teamId || '').trim();
    if (!teamId) throw Object.assign(new Error('Team ID requis.'), { status: 400 });

    const teams = await sql`
      select distinct teams.*
      from teams
      left join team_members on team_members.team_id = teams.id and team_members.user_id = ${user.id}
      where teams.id = ${teamId}
        and (teams.owner_id = ${user.id} or team_members.role in ('captain', 'coach'))
      limit 1
    `;
    const team = teams[0];
    if (!team) throw Object.assign(new Error('Seul l’owner, un capitaine ou un coach peut synchroniser les most played.'), { status: 403 });

    const players = await sql`select * from players where team_id = ${teamId} order by created_at asc`;
    if (!players.length) throw Object.assign(new Error('Ajoute au moins un joueur avant de synchroniser les most played.'), { status: 400 });

    const platform = platformFromRegion(team.region);
    const championData = await getChampionDataMap();
    const results = [];

    for (const player of players) {
      try {
        const staffRole = STAFF_ROLES.has(String(player.role || '').toUpperCase());
        if (staffRole || !player.riot_id) {
          await sql`
            update players
            set most_played = ${JSON.stringify([])}::jsonb,
                performance_score = null,
                status = ${staffRole ? 'Profil staff sans Riot ID' : 'Riot ID manquant'},
                updated_at = now()
            where id = ${player.id}
          `;
          results.push({ playerId: player.id, riotId: player.riot_id, ok: true, skipped: true, reason: staffRole ? 'Profil staff sans Riot ID' : 'Riot ID manquant' });
          continue;
        }

        const account = await fetchAccountByRiotId(player.riot_id, platform);
        const mostPlayed = await fetchCurrentSeasonSoloqMostPlayed(account.puuid, platform, championData);
        if (!mostPlayed.length) throw new Error('Aucun match SoloQ trouvé sur la saison courante.');

        const totalPoints = mostPlayed.reduce((sum, item) => sum + Number(item.points || 0), 0);
        await sql`
          update players
          set most_played = ${JSON.stringify(mostPlayed)}::jsonb,
              performance_score = ${totalPoints || null},
              status = ${mostPlayed.length ? 'Top SoloQ saison synchronisé' : 'Aucun match SoloQ saison trouvé'},
              updated_at = now()
          where id = ${player.id}
        `;

        let poolCount = 0;
        for (const [index, champion] of mostPlayed.entries()) {
          const status = index === 0 ? 'lock' : index < 3 ? 'pocket' : 'work';
          const verdict = index === 0 ? 'Champion le plus joué en SoloQ sur la saison courante.' : 'Champion récurrent en SoloQ sur la saison courante.';
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
              ${'SAISON'},
              ${verdict},
              ${player.role},
              ${status},
              ${`${champion.games || 0} games SoloQ saison courante`},
              ${'match_history'},
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

        results.push({ playerId: player.id, riotId: player.riot_id, ok: true, mostPlayed, poolCount, source: 'ranked_solo_history' });
      } catch (err) {
        await sql`
          update players
          set most_played = ${JSON.stringify([])}::jsonb,
              performance_score = null,
              status = ${err.message || 'Analyse Riot impossible'},
              updated_at = now()
          where id = ${player.id}
        `;
        results.push({ playerId: player.id, riotId: player.riot_id, ok: false, error: err.message || 'Analyse impossible' });
      }
    }

    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, 'players.sync_most_played', 'team', ${teamId}, ${JSON.stringify({ count: players.length, platform, queue: RANKED_SOLO_QUEUE, maxMatches: profileSyncMaxMatches() })}::jsonb)
    `;

    return json({ results });
  } catch (err) {
    return handleError(err);
  }
}
