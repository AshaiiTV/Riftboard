import { json, readJson, handleError } from './_lib/http.mjs';
import { fetchRiotMatch } from './_lib/riot.mjs';

const EUROPE_PLATFORMS = ['EUW1', 'EUN1', 'TR1', 'RU'];

function normalizePlatform(value) {
  const platform = String(value || 'EUW1').trim().toUpperCase();
  const aliases = { EUW: 'EUW1', EUNE: 'EUN1', EUN: 'EUN1', TR: 'TR1' };
  return aliases[platform] || platform || 'EUW1';
}

function readGameId(value, platform = 'EUW1', fallback = false) {
  const raw = String(value || '').trim().toUpperCase();
  const gameId = raw.includes('_') ? raw : `${normalizePlatform(platform)}_${raw}`;
  if (!/^([A-Z0-9]+)_\d+$/.test(gameId)) {
    throw Object.assign(new Error('Game ID invalide. Format attendu : 7123456789 ou EUW1_7123456789.'), {
      status: 400,
      code: 'NXT5_EXPORT_GAME_ID_INVALID'
    });
  }
  return { gameId, rawNumericId: raw.includes('_') ? gameId.split('_')[1] : raw, wasNumericOnly: !raw.includes('_') || fallback };
}

function candidateGameIds({ gameId, rawNumericId, wasNumericOnly }) {
  const primaryPlatform = gameId.split('_')[0];
  const platforms = wasNumericOnly
    ? [primaryPlatform, ...EUROPE_PLATFORMS.filter((platform) => platform !== primaryPlatform)]
    : [primaryPlatform];
  return [...new Set(platforms.map((platform) => `${platform}_${rawNumericId}`))];
}

async function fetchFirstAvailableMatch(input) {
  const attempts = [];
  for (const candidate of candidateGameIds(input)) {
    try {
      const match = await fetchRiotMatch(candidate);
      return { gameId: candidate, match, attempts };
    } catch (err) {
      attempts.push(`${candidate}: ${err.message}`);
      if (err.status && err.status !== 404) throw err;
    }
  }

  throw Object.assign(
    new Error(`Game ID introuvable côté Riot. IDs testés : ${candidateGameIds(input).join(', ')}. Vérifie la région, attends quelques minutes si la game vient de finir, ou importe le JSON depuis le Game ID complet.`),
    {
      status: 404,
      code: 'NXT5_EXPORT_MATCH_NOT_FOUND',
      details: attempts
    }
  );
}

export default async function handler(request) {
  try {
    if (!['GET', 'POST'].includes(request.method)) {
      throw Object.assign(new Error(`Méthode ${request.method} refusée. GET ou POST attendu.`), { status: 405 });
    }

    const url = new URL(request.url);
    const body = request.method === 'POST' ? await readJson(request) : {};
    const shouldFallback = url.searchParams.get('fallback') === '1' || body.fallback === true;
    const input = readGameId(url.searchParams.get('gameId') || body.gameId, url.searchParams.get('platform') || body.platform, shouldFallback);
    const { gameId, match } = await fetchFirstAvailableMatch(input);

    return json({
      source: 'nxt5-riot-match-export',
      version: 2,
      gameId,
      platform: gameId.split('_')[0],
      exportedAt: new Date().toISOString(),
      match
    });
  } catch (err) {
    return handleError(err);
  }
}
