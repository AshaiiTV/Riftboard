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

function participantRiotId(p) {
  const gameName = p.riotIdGameName || p.summonerName || '';
  const tag = p.riotIdTagline || '';
  return tag ? `${gameName}#${tag}` : gameName;
}

function gradeParticipant({ kdaValue, csPerMin, kp, vision, role }) {
  let score = 0;
  if (kdaValue >= 5) score += 3;
  else if (kdaValue >= 3) score += 2;
  else if (kdaValue >= 2) score += 1;
  else score -= 1;

  if (role === 'ADC' || role === 'MID' || role === 'TOP') {
    if (csPerMin >= 8) score += 2;
    else if (csPerMin >= 7) score += 1;
    else if (csPerMin < 5.5) score -= 1;
  }

  if (kp >= 0.7) score += 2;
  else if (kp >= 0.55) score += 1;
  else if (kp < 0.35) score -= 1;

  if (vision >= 45) score += 2;
  else if (vision >= 25) score += 1;

  if (score >= 6) return 'S';
  if (score >= 4) return 'A';
  if (score >= 2) return 'B';
  if (score >= 0) return 'C';
  return 'D';
}

function teamKills(match, teamId) {
  return match.info.participants
    .filter((p) => p.teamId === teamId)
    .reduce((sum, p) => sum + Number(p.kills || 0), 0);
}

function detectAllyTeam(match, roster) {
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

function buildParticipants(match, allyTeamId, roster) {
  const durationMin = Math.max(1, Number(match.info.gameDuration || 0) / 60);
  const rosterByRiot = new Map();
  for (const player of roster) {
    rosterByRiot.set(normalizeRiotId(player.riot_id), player);
  }

  return match.info.participants
    .slice()
    .sort((a, b) => (a.teamId - b.teamId) || ((ROLE_ORDER[a.teamPosition] || 99) - (ROLE_ORDER[b.teamPosition] || 99)))
    .map((p) => {
      const role = normalizeRole(p.teamPosition || p.individualPosition || p.lane, p.participantId);
      const kills = Number(p.kills || 0);
      const deaths = Number(p.deaths || 0);
      const assists = Number(p.assists || 0);
      const cs = Number(p.totalMinionsKilled || 0) + Number(p.neutralMinionsKilled || 0);
      const gold = Number(p.goldEarned || 0);
      const damage = Number(p.totalDamageDealtToChampions || 0);
      const vision = Number(p.visionScore || 0);
      const killsForTeam = Math.max(1, teamKills(match, p.teamId));
      const kp = (kills + assists) / killsForTeam;
      const kdaValue = (kills + assists) / Math.max(1, deaths);
      const csPerMin = cs / durationMin;
      const goldPerMin = gold / durationMin;
      const rid = participantRiotId(p);
      const player = rosterByRiot.get(normalizeRiotId(rid)) || rosterByRiot.get(normalizeRiotId(p.summonerName));

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
        grade: gradeParticipant({ kdaValue, csPerMin, kp, vision, role }),
        raw: p
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

  let primaryFocus = 'Review complète à effectuer';
  let mainIssue = 'Pas assez de signaux faibles détectés';

  if (visionDiff < -20) {
    primaryFocus = 'Setup vision avant objectifs';
    mainIssue = `Vision diff négative (${visionDiff})`;
  } else if (ally.some((p) => p.deaths >= 7)) {
    primaryFocus = 'Réduire les morts isolées';
    mainIssue = 'Un joueur allié dépasse 7 morts';
  } else if (dragons < 2 && !allyTeam?.win) {
    primaryFocus = 'Contrôle dragons';
    mainIssue = 'Peu de dragons sécurisés dans une défaite';
  } else if (allyTeam?.win) {
    primaryFocus = 'Identifier les conditions de victoire';
    mainIssue = 'Game gagnée : consolider les patterns efficaces';
  }

  const avgGradeScore = ally.reduce((sum, p) => sum + ({ S: 5, A: 4, B: 3, C: 2, D: 1 }[p.grade] || 2), 0) / Math.max(1, ally.length);
  const impactScore = avgGradeScore >= 4.5 ? 'S' : avgGradeScore >= 3.8 ? 'A' : avgGradeScore >= 3 ? 'B' : avgGradeScore >= 2 ? 'C' : 'D';

  return {
    result: allyTeam?.win ? 'Victoire' : 'Défaite',
    side: allyTeamId === 100 ? 'Blue Side' : 'Red Side',
    duration_seconds: match.info.gameDuration,
    duration,
    patch,
    objective_score: `Dragons ${dragons} · Barons ${barons} · Tours ${towers}`,
    vision_score: visionDiff >= 0 ? `+${visionDiff}` : String(visionDiff),
    impact_score: impactScore,
    primary_focus: primaryFocus,
    main_issue: mainIssue,
    opponent: 'Enemy Team'
  };
}

function reportForMatch({ team, summary, participants }) {
  const ally = participants.filter((p) => p.team_key === 'ALLY');
  const gradeScoreMap = { S: 5, A: 4, B: 3, C: 2, D: 1 };
  const best = ally.slice().sort((a, b) => (gradeScoreMap[b.grade] || 0) - (gradeScoreMap[a.grade] || 0))[0];
  const risky = ally.slice().sort((a, b) => b.deaths - a.deaths)[0];

  return `## 📊 Review — ${team.name}\n\n**Résultat :** ${summary.result}  \n**Durée :** ${summary.duration}  \n**Side :** ${summary.side}  \n**Objectifs :** ${summary.objective_score}  \n**Vision diff :** ${summary.vision_score}\n\n### ✅ Points forts\n- Meilleur impact individuel : **${best?.summoner_name || 'N/A'}** sur **${best?.champion || 'N/A'}** (${best?.grade || '—'}).\n- Score d'impact global : **${summary.impact_score}**.\n- Focus détecté : **${summary.primary_focus}**.\n\n### ⚠️ Points à corriger\n- Signal principal : **${summary.main_issue}**.\n- Joueur le plus exposé : **${risky?.summoner_name || 'N/A'}** (${risky?.deaths ?? '—'} morts).\n\n### 🎯 Focus prochain scrim\n- Revoir les 90 secondes avant objectif neutre.\n- Vérifier la vision rivière + entrées jungle.\n- Identifier les morts évitables avant dragon/Nashor.`;
}

async function rebuildChampionPool(teamId) {
  await sql`delete from champion_pool where team_id = ${teamId}`;

  const rows = await sql`
    select
      p.player_id as player_id,
      coalesce(pl.name, p.summoner_name) as player_name,
      p.champion,
      count(*)::int as games,
      sum(case when m.result = 'Victoire' then 1 else 0 end)::int as wins,
      sum(case when m.result = 'Défaite' then 1 else 0 end)::int as losses,
      avg((p.kills + p.assists)::numeric / greatest(1, p.deaths)) as kda,
      avg(p.cs_per_min) as cs_per_min,
      avg(case p.grade when 'S' then 5 when 'A' then 4 when 'B' then 3 when 'C' then 2 else 1 end) as grade_score
    from match_participants p
    join matches m on m.id = p.match_id
    left join players pl on pl.id = p.player_id
    where m.team_id = ${teamId}
      and p.team_key = 'ALLY'
    group by p.player_id, pl.name, p.summoner_name, p.champion
  `;

  for (const r of rows) {
    const winrate = Math.round((Number(r.wins) / Math.max(1, Number(r.games))) * 100);
    const gradeScore = Number(r.grade_score || 0);
    const impactGrade = gradeScore >= 4.5 ? 'S' : gradeScore >= 3.8 ? 'A' : gradeScore >= 3 ? 'B' : gradeScore >= 2 ? 'C' : 'D';
    let verdict = 'Données insuffisantes';
    if (r.games >= 5 && winrate >= 60 && gradeScore >= 3.5) verdict = 'Pick fiable / priorité haute';
    else if (r.games >= 5 && winrate <= 40) verdict = 'Pick à retravailler';
    else if (r.games >= 3 && gradeScore >= 4) verdict = 'Fort potentiel';
    else if (r.games >= 3) verdict = 'Situationnel';

    await sql`
      insert into champion_pool (team_id, player_id, player_name, champion, games, wins, losses, winrate, kda, cs_per_min, impact_grade, verdict)
      values (${teamId}, ${r.player_id}, ${r.player_name}, ${r.champion}, ${r.games}, ${r.wins}, ${r.losses}, ${winrate}, ${Number(r.kda || 0).toFixed(2)}, ${Number(r.cs_per_min || 0).toFixed(1)}, ${impactGrade}, ${verdict})
    `;
  }
}

async function rebuildImprovements(teamId) {
  await sql`delete from improvements where team_id = ${teamId}`;

  const recent = await sql`
    select * from matches
    where team_id = ${teamId}
    order by created_at desc
    limit 12
  `;

  if (!recent.length) return;

  const badVision = recent.filter((m) => String(m.vision_score || '').startsWith('-')).length;
  const losses = recent.filter((m) => m.result === 'Défaite').length;

  const priorities = [];
  if (badVision >= 3) priorities.push({ title: 'Setup vision avant objectifs', severity: 'high', proof: `${badVision} games récentes avec vision diff négative.`, action: 'Reset 1:10 avant objectif, ward rivière + entrées jungle, refuser le contest sans prio mid.', evidence: { badVision } });
  if (losses >= 3) priorities.push({ title: 'Conversion des games perdantes', severity: 'medium', proof: `${losses} défaites dans les ${recent.length} dernières games importées.`, action: 'Isoler les patterns des défaites : premier objectif perdu, mort avant Nashor, side lane non couverte.', evidence: { losses } });
  priorities.push({ title: 'Revue champion pool', severity: 'medium', proof: 'Les picks fiables et picks risqués doivent être confirmés par volume de games.', action: 'Garder les champions à fort volume + impact, retravailler ceux sous 40% WR avec au moins 5 games.', evidence: {} });

  for (let i = 0; i < Math.min(3, priorities.length); i += 1) {
    const p = priorities[i];
    await sql`
      insert into improvements (team_id, rank, title, severity, proof, action, evidence)
      values (${teamId}, ${i + 1}, ${p.title}, ${p.severity}, ${p.proof}, ${p.action}, ${JSON.stringify(p.evidence)}::jsonb)
    `;
  }
}

export async function persistAnalyzedMatch({ team, gameId, match, roster, userId = null }) {
  const allyTeamId = detectAllyTeam(match, roster);
  const participants = buildParticipants(match, allyTeamId, roster);
  const summary = buildMatchSummary(match, allyTeamId, participants);

  const inserted = await sql`
    insert into matches (
      team_id, game_id, region, opponent, result, side,
      duration_seconds, duration, patch, objective_score, vision_score,
      impact_score, primary_focus, main_issue, raw
    )
    values (
      ${team.id}, ${gameId}, 'EUROPE', ${summary.opponent}, ${summary.result}, ${summary.side},
      ${summary.duration_seconds}, ${summary.duration}, ${summary.patch}, ${summary.objective_score}, ${summary.vision_score},
      ${summary.impact_score}, ${summary.primary_focus}, ${summary.main_issue}, ${JSON.stringify(match)}::jsonb
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
      raw = excluded.raw
    returning *
  `;

  const savedMatch = inserted[0];
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
