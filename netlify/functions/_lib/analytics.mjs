import { sql } from './db.mjs';

const ROLE_ORDER = { TOP: 1, JUNGLE: 2, JGL: 2, MIDDLE: 3, MID: 3, BOTTOM: 4, ADC: 4, UTILITY: 5, SUP: 5, SUPPORT: 5 };

function mmss(seconds) {
  const s = Number(seconds || 0);
  const min = Math.floor(s / 60);
  const sec = String(s % 60).padStart(2, '0');
  return `${min}:${sec}`;
}

function normalizeRiotId(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, '').replace('#', '-');
}

function normalizeRole(value, participantId = 0) {
  const roleRaw = String(value || '').toUpperCase();
  if (roleRaw === 'JUNGLE') return 'JGL';
  if (roleRaw === 'MIDDLE') return 'MID';
  if (roleRaw === 'BOTTOM') return 'ADC';
  if (roleRaw === 'UTILITY' || roleRaw === 'SUPPORT') return 'SUP';
  if (['TOP', 'JGL', 'MID', 'ADC', 'SUP'].includes(roleRaw)) return roleRaw;
  const index = ((Number(participantId || 1) - 1) % 5) + 1;
  return ['TOP', 'JGL', 'MID', 'ADC', 'SUP'][index - 1] || 'UNKNOWN';
}

function normalizeLoose(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeLaneAssignments(value) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(['TOP', 'JGL', 'MID', 'ADC', 'SUP'].map((role) => [role, normalizeLoose(source[role])]).filter(([, text]) => text));
}

function normalizePlayerAssignments(value) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(['TOP', 'JGL', 'MID', 'ADC', 'SUP'].map((role) => [role, String(source[role] || '').trim()]).filter(([, text]) => text));
}

function teamIdFromSide(side) {
  const value = String(side || '').trim().toUpperCase();
  if (value === 'BLUE' || value === 'BLUE SIDE' || value === '100') return 100;
  if (value === 'RED' || value === 'RED SIDE' || value === '200') return 200;
  return null;
}

function participantRiotId(p) {
  const gameName = p.riotIdGameName || p.summonerName || '';
  const tag = p.riotIdTagline || '';
  return tag ? `${gameName}#${tag}` : gameName;
}

function participantNumber(p, ...keys) {
  for (const source of [p, p?.stats].filter(Boolean)) {
    for (const key of keys) {
      const value = Number(source?.[key] ?? 0);
      if (value) return value;
    }
  }
  return 0;
}

function participantRawSnapshot(p) {
  return {
    ...p,
    item0: participantNumber(p, 'item0', 'item0Id'),
    item1: participantNumber(p, 'item1', 'item1Id'),
    item2: participantNumber(p, 'item2', 'item2Id'),
    item3: participantNumber(p, 'item3', 'item3Id'),
    item4: participantNumber(p, 'item4', 'item4Id'),
    item5: participantNumber(p, 'item5', 'item5Id'),
    item6: participantNumber(p, 'item6', 'item6Id', 'trinket', 'trinketItemId'),
    summoner1Id: participantNumber(p, 'summoner1Id', 'spell1Id'),
    summoner2Id: participantNumber(p, 'summoner2Id', 'spell2Id')
  };
}

function manualRoleForParticipant(p, laneAssignments) {
  const champion = normalizeLoose(p.championName);
  const summoner = normalizeLoose(p.summonerName);
  const riot = normalizeLoose(participantRiotId(p));
  for (const [role, expected] of Object.entries(laneAssignments || {})) {
    if (expected && [champion, summoner, riot].includes(expected)) return role;
  }
  return null;
}

function teamKills(match, teamId) {
  return match.info.participants
    .filter((p) => p.teamId === teamId)
    .reduce((sum, p) => sum + Number(p.kills || 0), 0);
}

function detectAllyTeam(match, roster, allyTeamSide = '') {
  const sideTeamId = teamIdFromSide(allyTeamSide);
  if (sideTeamId) return sideTeamId;

  const normalizedRoster = new Set(roster.map((p) => normalizeRiotId(p.riot_id)).filter(Boolean));

  for (const participant of match.info.participants) {
    const rid = normalizeRiotId(participantRiotId(participant));
    const summoner = normalizeRiotId(participant.summonerName);
    if (normalizedRoster.has(rid) || normalizedRoster.has(summoner)) {
      return participant.teamId;
    }
  }

  throw Object.assign(new Error('Aucun joueur du roster ne correspond à cette game. Ajoute les bons Riot IDs avant import.'), { status: 400 });
}

function buildParticipants(match, allyTeamId, roster, laneAssignments = {}, playerAssignments = {}) {
  const durationMin = Math.max(1, Number(match.info.gameDuration || 0) / 60);
  const rosterByRiot = new Map();
  const rosterById = new Map();
  for (const player of roster) {
    rosterByRiot.set(normalizeRiotId(player.riot_id), player);
    rosterById.set(String(player.id), player);
  }

  return match.info.participants
    .slice()
    .sort((a, b) => (a.teamId - b.teamId) || ((ROLE_ORDER[a.teamPosition] || 99) - (ROLE_ORDER[b.teamPosition] || 99)))
    .map((p) => {
      const manualRole = p.teamId === allyTeamId ? manualRoleForParticipant(p, laneAssignments) : null;
      const role = p.teamId === allyTeamId ? (manualRole || 'UNKNOWN') : normalizeRole(p.teamPosition || p.individualPosition || p.lane, p.participantId);
      const kills = Number(p.kills || 0);
      const deaths = Number(p.deaths || 0);
      const assists = Number(p.assists || 0);
      const cs = Number(p.totalMinionsKilled || 0) + Number(p.neutralMinionsKilled || 0);
      const gold = Number(p.goldEarned || 0);
      const damage = Number(p.totalDamageDealtToChampions || 0);
      const vision = Number(p.visionScore || 0);
      const killsForTeam = Math.max(1, teamKills(match, p.teamId));
      const kp = (kills + assists) / killsForTeam;
      const csPerMin = cs / durationMin;
      const goldPerMin = gold / durationMin;
      const rid = participantRiotId(p);
      const assignedPlayerId = p.teamId === allyTeamId && manualRole ? playerAssignments[manualRole] : '';
      const player = rosterById.get(String(assignedPlayerId || '')) || rosterByRiot.get(normalizeRiotId(rid)) || rosterByRiot.get(normalizeRiotId(p.summonerName));

      return {
        player_id: player?.id || null,
        team_key: p.teamId === allyTeamId ? 'ALLY' : 'ENEMY',
        summoner_name: p.summonerName || p.riotIdGameName || 'Unknown',
        riot_id: rid,
        champion: p.championName,
        role,
        kills,
        deaths,
        assists,
        cs,
        gold,
        damage,
        vision,
        kp,
        kda: `${kills}/${deaths}/${assists}`,
        cs_per_min: Number(csPerMin.toFixed(1)),
        gold_per_min: Number(goldPerMin.toFixed(0)),
        kill_participation: `${Math.round(kp * 100)}%`,
        grade: null,
        raw: participantRawSnapshot(p)
      };
    });
}

function buildMatchSummary(match, allyTeamId, participants) {
  const ally = participants.filter((p) => p.team_key === 'ALLY');
  const enemy = participants.filter((p) => p.team_key === 'ENEMY');
  const allyTeam = match.info.teams.find((t) => t.teamId === allyTeamId);
  const allyVision = ally.reduce((sum, p) => sum + p.vision, 0);
  const enemyVision = enemy.reduce((sum, p) => sum + p.vision, 0);
  const visionDiff = allyVision - enemyVision;
  const dragons = allyTeam?.objectives?.dragon?.kills ?? 0;
  const barons = allyTeam?.objectives?.baron?.kills ?? 0;
  const towers = allyTeam?.objectives?.tower?.kills ?? 0;
  const duration = mmss(match.info.gameDuration);
  const patch = String(match.info.gameVersion || '').split('.').slice(0, 2).join('.');

  return {
    result: allyTeam?.win ? 'Victoire' : 'Défaite',
    side: allyTeamId === 100 ? 'Blue Side' : 'Red Side',
    duration_seconds: match.info.gameDuration,
    duration,
    patch,
    objective_score: `Dragons ${dragons} · Barons ${barons} · Tours ${towers}`,
    vision_score: visionDiff >= 0 ? `+${visionDiff}` : String(visionDiff),
    impact_score: null,
    primary_focus: null,
    main_issue: null,
    opponent: 'Enemy Team'
  };
}

function reportForMatch({ team, summary, participants }) {
  const ally = participants.filter((p) => p.team_key === 'ALLY');
  const rows = ally
    .map((p) => `- **${p.role || 'ROLE'} ${p.summoner_name || p.riot_id || 'Joueur'}** sur **${p.champion || 'Champion'}** : ${p.kda}, ${p.cs_per_min} CS/min, ${p.gold_per_min} gold/min, ${p.damage} dégâts, ${p.vision} vision.`)
    .join('\n');

  return `## Review — ${team.name}\n\n**Résultat :** ${summary.result}  \n**Durée :** ${summary.duration}  \n**Side :** ${summary.side}  \n**Objectifs neutres :** ${summary.objective_score}  \n**Vision diff :** ${summary.vision_score}\n\n### Données joueurs\n${rows || '- Aucun participant allié détecté.'}`;
}

async function rebuildChampionPool(teamId) {
  const rows = await sql`
    select
      p.player_id as player_id,
      coalesce(pl.name, p.summoner_name) as player_name,
      pl.role as role,
      p.champion,
      count(*)::int as games,
      sum(case when m.result = 'Victoire' then 1 else 0 end)::int as wins,
      sum(case when m.result = 'Défaite' then 1 else 0 end)::int as losses,
      avg((p.kills + p.assists)::numeric / greatest(1, p.deaths)) as kda,
      avg(p.cs_per_min) as cs_per_min
    from match_participants p
    join matches m on m.id = p.match_id
    left join players pl on pl.id = p.player_id
    where m.team_id = ${teamId}
      and p.team_key = 'ALLY'
    group by p.player_id, pl.name, pl.role, p.summoner_name, p.champion
  `;

  for (const r of rows) {
    const winrate = Math.round((Number(r.wins) / Math.max(1, Number(r.games))) * 100);
    let verdict = 'Données insuffisantes';
    if (r.games >= 5 && winrate >= 60) verdict = 'Volume élevé, WR positif';
    else if (r.games >= 5 && winrate <= 40) verdict = 'Volume élevé, WR faible';
    else if (r.games >= 3) verdict = 'Situationnel';

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
        source,
        updated_at
      )
      values (
        ${teamId},
        ${r.player_id},
        ${r.player_name},
        ${r.champion},
        ${r.games},
        ${r.wins},
        ${r.losses},
        ${winrate},
        ${Number(r.kda || 0).toFixed(2)},
        ${Number(r.cs_per_min || 0).toFixed(1)},
        null,
        ${verdict},
        ${r.role},
        'work',
        'riot',
        now()
      )
      on conflict (team_id, player_id, champion) do update
      set player_name = excluded.player_name,
          games = excluded.games,
          wins = excluded.wins,
          losses = excluded.losses,
          winrate = excluded.winrate,
          kda = excluded.kda,
          cs_per_min = excluded.cs_per_min,
          impact_grade = case when champion_pool.source in ('manual', 'riot_manual') then champion_pool.impact_grade else excluded.impact_grade end,
          verdict = case when champion_pool.source in ('manual', 'riot_manual') then champion_pool.verdict else excluded.verdict end,
          status = case when champion_pool.source in ('manual', 'riot_manual') then champion_pool.status else excluded.status end,
          notes = case when champion_pool.source in ('manual', 'riot_manual') then champion_pool.notes else champion_pool.notes end,
          source = case when champion_pool.source in ('manual', 'riot_manual') then 'riot_manual' else excluded.source end,
          updated_at = now()
    `;
  }
}

async function rebuildImprovements(teamId) {
  await sql`delete from improvements where team_id = ${teamId}`;
}

async function archiveRawMatch({ teamId, matchId, gameId, match, source = 'import' }) {
  await sql`
    create table if not exists match_raw_archives (
      id uuid primary key default gen_random_uuid(),
      team_id uuid not null references teams(id) on delete cascade,
      match_id uuid references matches(id) on delete cascade,
      game_id text not null,
      source text not null default 'import',
      payload jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      unique(team_id, game_id)
    )
  `;
  await sql`
    insert into match_raw_archives (team_id, match_id, game_id, source, payload)
    values (${teamId}, ${matchId}, ${gameId}, ${source}, ${JSON.stringify(match)}::jsonb)
    on conflict (team_id, game_id)
    do update set
      match_id = excluded.match_id,
      source = excluded.source,
      payload = excluded.payload
  `;
}

async function ensureMatchImporterColumn() {
  await sql`alter table matches add column if not exists created_by uuid references users(id) on delete set null`;
  await sql`alter table matches add column if not exists raw jsonb not null default '{}'::jsonb`;
  await sql`alter table match_participants add column if not exists raw jsonb not null default '{}'::jsonb`;
  await sql`alter table reports add column if not exists match_ids jsonb not null default '[]'::jsonb`;
  await sql`alter table reports add column if not exists created_by uuid references users(id) on delete set null`;
  await sql`alter table reports add column if not exists updated_at timestamptz not null default now()`;
  await sql`create index if not exists idx_matches_created_by on matches(created_by)`;
}

export async function persistAnalyzedMatch({ team, gameId, match, roster, userId = null, laneAssignments = {}, playerAssignments = {}, allyTeamSide = '' }) {
  await ensureMatchImporterColumn();
  const allyTeamId = detectAllyTeam(match, roster, allyTeamSide);
  const normalizedLaneAssignments = normalizeLaneAssignments(laneAssignments);
  const normalizedPlayerAssignments = normalizePlayerAssignments(playerAssignments);
  const requiredRoles = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
  const missingInputs = requiredRoles.filter((role) => !normalizedLaneAssignments[role]);
  if (missingInputs.length) {
    throw Object.assign(new Error(`Assignation des lanes requise : indique ${missingInputs.join(', ')} avant d’importer. Utilise le champion ou le pseudo exact visible dans la game.`), { status: 400 });
  }
  const missingProfiles = requiredRoles.filter((role) => !normalizedPlayerAssignments[role]);
  if (missingProfiles.length) {
    throw Object.assign(new Error(`Liaison profil requise : associe ${missingProfiles.join(', ')} à un profil de l’équipe avant d’importer.`), { status: 400 });
  }
  const participants = buildParticipants(match, allyTeamId, roster, normalizedLaneAssignments, normalizedPlayerAssignments);
  const assignedRoles = new Set(participants.filter((p) => p.team_key === 'ALLY').map((p) => p.role));
  const missingRoles = requiredRoles.filter((role) => !assignedRoles.has(role));
  if (missingRoles.length) {
    throw Object.assign(new Error(`Assignation des lanes incomplète : ${missingRoles.join(', ')} non reconnu(s). Utilise le champion ou le pseudo exact visible dans la game.`), { status: 400 });
  }
  const summary = buildMatchSummary(match, allyTeamId, participants);

  const inserted = await sql`
    insert into matches (
      team_id, game_id, region, opponent, result, side,
      duration_seconds, duration, patch, objective_score, vision_score,
      impact_score, primary_focus, main_issue, created_by, raw
    )
    values (
      ${team.id}, ${gameId}, 'EUROPE', ${summary.opponent}, ${summary.result}, ${summary.side},
      ${summary.duration_seconds}, ${summary.duration}, ${summary.patch}, ${summary.objective_score}, ${summary.vision_score},
      ${summary.impact_score}, ${summary.primary_focus}, ${summary.main_issue}, ${userId}, ${JSON.stringify(match)}::jsonb
    )
    on conflict (team_id, game_id)
    do update set
      opponent = excluded.opponent,
      result = excluded.result,
      side = excluded.side,
      duration_seconds = excluded.duration_seconds,
      duration = excluded.duration,
      patch = excluded.patch,
      objective_score = excluded.objective_score,
      vision_score = excluded.vision_score,
      impact_score = excluded.impact_score,
      primary_focus = excluded.primary_focus,
      main_issue = excluded.main_issue,
      created_by = coalesce(matches.created_by, excluded.created_by),
      raw = excluded.raw
    returning *
  `;

  const savedMatch = inserted[0];
  await archiveRawMatch({ teamId: team.id, matchId: savedMatch.id, gameId, match, source: match?.metadata?.source || 'import' });
  await sql`delete from match_participants where match_id = ${savedMatch.id}`;

  for (const p of participants) {
    await sql`
      insert into match_participants (
        match_id, player_id, team_key, summoner_name, riot_id, champion, role,
        kills, deaths, assists, cs, gold, damage, vision, kp, kda,
        cs_per_min, gold_per_min, kill_participation, grade, raw
      )
      values (
        ${savedMatch.id}, ${p.player_id}, ${p.team_key}, ${p.summoner_name}, ${p.riot_id}, ${p.champion}, ${p.role},
        ${p.kills}, ${p.deaths}, ${p.assists}, ${p.cs}, ${p.gold}, ${p.damage}, ${p.vision}, ${p.kp}, ${p.kda},
        ${p.cs_per_min}, ${p.gold_per_min}, ${p.kill_participation}, ${p.grade}, ${JSON.stringify(p.raw)}::jsonb
      )
    `;
  }

  await rebuildChampionPool(team.id);
  await rebuildImprovements(team.id);

  const report = reportForMatch({ team, summary, participants });
  await sql`
    insert into reports (team_id, match_id, match_ids, created_by, title, content)
    values (${team.id}, ${savedMatch.id}, ${JSON.stringify([savedMatch.id])}::jsonb, ${userId}, ${`Review — ${team.name} — ${gameId}`}, ${report})
  `;

  return savedMatch;
}
