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

async function riotFetch(url, notFoundMessage) {
  requireRiotKey();
  const response = await fetch(url, {
    headers: { 'X-Riot-Token': process.env.RIOT_API_KEY }
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

export async function fetchRiotMatch(gameId) {
  const regional = regionFromGameId(gameId).toLowerCase();
  const url = `https://${regional}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(gameId)}`;
  return riotFetch(url, 'Game ID introuvable côté Riot.');
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
