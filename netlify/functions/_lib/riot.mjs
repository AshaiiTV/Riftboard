const ROUTES = {
  EUW1: 'EUROPE',
  EUN1: 'EUROPE',
  TR1: 'EUROPE',
  RU: 'EUROPE',
  NA1: 'AMERICAS',
  BR1: 'AMERICAS',
  LA1: 'AMERICAS',
  LA2: 'AMERICAS',
  KR: 'ASIA',
  JP1: 'ASIA',
  OC1: 'SEA',
  PH2: 'SEA',
  SG2: 'SEA',
  TH2: 'SEA',
  TW2: 'SEA',
  VN2: 'SEA'
};

const PLATFORM_BY_REGION = {
  EUW: 'EUW1',
  EUW1: 'EUW1',
  EUNE: 'EUN1',
  EUN: 'EUN1',
  EUN1: 'EUN1',
  NA: 'NA1',
  NA1: 'NA1',
  BR: 'BR1',
  BR1: 'BR1',
  LAN: 'LA1',
  LA1: 'LA1',
  LAS: 'LA2',
  LA2: 'LA2',
  KR: 'KR',
  JP: 'JP1',
  JP1: 'JP1',
  OCE: 'OC1',
  OC1: 'OC1',
  TR: 'TR1',
  TR1: 'TR1',
  RU: 'RU'
};

const ACCOUNT_REGION_BY_PLATFORM = {
  ...ROUTES
};

let championNameCache = null;
let championDataCache = null;

export function isRiotConfigured() {
  return Boolean(process.env.RIOT_API_KEY);
}

export function regionFromGameId(gameId) {
  const platform = String(gameId || '').split('_')[0]?.toUpperCase();
  return ROUTES[platform] || 'EUROPE';
}

export function platformFromRegion(region = 'EUW') {
  const normalized = String(region || 'EUW').trim().toUpperCase();
  const platform = PLATFORM_BY_REGION[normalized] || normalized || 'EUW1';
  return ROUTES[platform] ? platform : 'EUW1';
}

export function accountRegionFromPlatform(platform = 'EUW1') {
  return ACCOUNT_REGION_BY_PLATFORM[String(platform || '').toUpperCase()] || 'EUROPE';
}

function requireRiotKey() {
  if (!isRiotConfigured()) {
    throw Object.assign(new Error('RIOT_API_KEY manquante. Configure la clé Riot dans Netlify.'), {
      status: 500,
      code: 'RIOT_KEY_MISSING'
    });
  }
}

export async function riotFetch(url, notFoundMessage, options = {}) {
  requireRiotKey();
  const response = await fetch(url, {
    ...options,
    headers: {
      'X-Riot-Token': process.env.RIOT_API_KEY,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });

  if (response.status === 401 || response.status === 403) {
    throw Object.assign(new Error('Clé Riot refusée. Vérifie RIOT_API_KEY dans Netlify et sa validité.'), {
      status: 502,
      code: 'RIOT_KEY_REJECTED'
    });
  }
  if (response.status === 404) {
    throw Object.assign(new Error(notFoundMessage || 'Ressource Riot introuvable.'), { status: 404 });
  }
  if (response.status === 429) {
    throw Object.assign(new Error('Rate limit Riot atteint. Réessaie plus tard.'), {
      status: 429,
      code: 'RIOT_RATE_LIMIT'
    });
  }
  if (!response.ok) {
    throw Object.assign(new Error(`Erreur Riot API ${response.status}.`), {
      status: 502,
      code: 'RIOT_API_ERROR'
    });
  }

  return response.json();
}

export function tournamentConfigStatus() {
  const canUseExistingTournament = Boolean(process.env.RIOT_TOURNAMENT_ID);
  const canCreateTournament = Boolean(process.env.RIOT_TOURNAMENT_CALLBACK_URL);
  return {
    ready: Boolean(process.env.RIOT_API_KEY && (canUseExistingTournament || canCreateTournament)),
    missing: [
      !process.env.RIOT_API_KEY && 'RIOT_API_KEY',
      !canUseExistingTournament && !canCreateTournament && 'RIOT_TOURNAMENT_ID ou RIOT_TOURNAMENT_CALLBACK_URL'
    ].filter(Boolean)
  };
}

export async function createTournamentProvider({ platform = 'EUW1', callbackUrl = process.env.RIOT_TOURNAMENT_CALLBACK_URL } = {}) {
  if (!callbackUrl) {
    throw Object.assign(new Error('RIOT_TOURNAMENT_CALLBACK_URL manquante pour créer un provider Riot.'), {
      status: 503,
      code: 'RIOT_TOURNAMENT_NOT_CONFIGURED'
    });
  }
  const host = platformFromRegion(platform).toLowerCase();
  const url = `https://${host}.api.riotgames.com/lol/tournament/v5/providers`;
  return riotFetch(url, 'Impossible de créer le provider tournoi côté Riot.', {
    method: 'POST',
    body: JSON.stringify({ region: platformFromRegion(platform), url: callbackUrl })
  });
}

export async function createTournament({ providerId, platform = 'EUW1', name = process.env.RIOT_TOURNAMENT_NAME || 'RiftBoard Scrims' } = {}) {
  if (!providerId) throw Object.assign(new Error('Provider Riot manquant.'), { status: 400 });
  const host = platformFromRegion(platform).toLowerCase();
  const url = `https://${host}.api.riotgames.com/lol/tournament/v5/tournaments`;
  return riotFetch(url, 'Impossible de créer le tournoi côté Riot.', {
    method: 'POST',
    body: JSON.stringify({ name, providerId })
  });
}

async function resolveTournamentId(platform) {
  if (process.env.RIOT_TOURNAMENT_ID) return process.env.RIOT_TOURNAMENT_ID;
  const providerId = await createTournamentProvider({ platform });
  return createTournament({ providerId, platform });
}

export async function createTournamentCode({ tournamentId = process.env.RIOT_TOURNAMENT_ID, platform = 'EUW1', count = 1, metadata = '' } = {}) {
  const config = tournamentConfigStatus();
  if (!config.ready) {
    throw Object.assign(new Error(`Génération Riot non configurée (${config.missing.join(', ')}). Tu peux quand même ajouter un code manuellement.`), {
      status: 503,
      code: 'RIOT_TOURNAMENT_NOT_CONFIGURED',
      missing: config.missing
    });
  }

  const host = platformFromRegion(platform).toLowerCase();
  const resolvedTournamentId = tournamentId || await resolveTournamentId(platform);
  const params = new URLSearchParams({ count: String(Math.max(1, Math.min(5, Number(count) || 1))), tournamentId: String(resolvedTournamentId) });
  const body = {
    allowedSummonerIds: [],
    metadata,
    teamSize: 5,
    pickType: 'TOURNAMENT_DRAFT',
    mapType: 'SUMMONERS_RIFT',
    spectatorType: 'ALL'
  };
  const url = `https://${host}.api.riotgames.com/lol/tournament/v5/codes?${params.toString()}`;
  return riotFetch(url, 'Impossible de générer le code tournoi côté Riot.', { method: 'POST', body: JSON.stringify(body) });
}

export async function fetchMatchIdsByTournamentCode(tournamentCode, platform = 'EUW1') {
  const regional = accountRegionFromPlatform(platform).toLowerCase();
  const url = `https://${regional}.api.riotgames.com/lol/match/v5/matches/by-tournament-code/${encodeURIComponent(tournamentCode)}/ids`;
  return riotFetch(url, 'Aucune game Riot trouvée pour ce code tournoi.');
}

export async function fetchRiotMatch(gameId) {
  const regional = regionFromGameId(gameId).toLowerCase();
  const url = `https://${regional}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(gameId)}`;
  return riotFetch(url, 'Game ID introuvable côté Riot.');
}

export async function fetchMatchIdsByPuuid(puuid, platform = 'EUW1', options = {}) {
  const regional = accountRegionFromPlatform(platform).toLowerCase();
  const params = new URLSearchParams();
  if (options.startTime) params.set('startTime', String(options.startTime));
  if (options.queue) params.set('queue', String(options.queue));
  params.set('start', String(options.start || 0));
  params.set('count', String(options.count || 20));
  const url = `https://${regional}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?${params.toString()}`;
  return riotFetch(url, 'Historique de matchs introuvable côté Riot.');
}

export async function fetchRiotMatchById(matchId, platform = 'EUW1') {
  const regional = accountRegionFromPlatform(platform).toLowerCase();
  const url = `https://${regional}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}`;
  return riotFetch(url, 'Match Riot introuvable.');
}

export async function fetchAccountByRiotId(riotId, platform = 'EUW1') {
  const [gameName, tagLine] = String(riotId || '').split('#').map((part) => part?.trim());
  if (!gameName || !tagLine) {
    throw Object.assign(new Error(`Riot ID invalide : ${riotId}`), { status: 400 });
  }

  const regional = accountRegionFromPlatform(platform).toLowerCase();
  const url = `https://${regional}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  return riotFetch(url, `Compte Riot introuvable : ${riotId}`);
}

export async function fetchTopChampionMastery(puuid, platform = 'EUW1', count = 5) {
  const host = platformFromRegion(platform).toLowerCase();
  const url = `https://${host}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${encodeURIComponent(puuid)}/top?count=${count}`;
  return riotFetch(url, 'Maîtrises champion introuvables côté Riot.');
}

export async function getChampionNameMap() {
  const data = await getChampionDataMap();
  return new Map([...data.entries()].map(([key, champion]) => [key, champion.name]));
}

export async function getChampionDataMap() {
  if (championDataCache) return championDataCache;

  const versionsResponse = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
  if (!versionsResponse.ok) {
    throw Object.assign(new Error('Impossible de charger Data Dragon.'), { status: versionsResponse.status });
  }
  const [version] = await versionsResponse.json();

  const championResponse = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/fr_FR/champion.json`);
  if (!championResponse.ok) {
    throw Object.assign(new Error('Impossible de charger la liste des champions.'), { status: championResponse.status });
  }
  const payload = await championResponse.json();

  championDataCache = new Map(
    Object.values(payload.data || {}).map((champion) => [Number(champion.key), {
      id: champion.id,
      name: champion.name,
      imageUrl: `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champion.image.full}`
    }])
  );
  championNameCache = new Map([...championDataCache.entries()].map(([key, champion]) => [key, champion.name]));
  return championDataCache;
}
