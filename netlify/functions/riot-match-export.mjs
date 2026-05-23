import { json, readJson, handleError } from './_lib/http.mjs';
import { fetchRiotMatch } from './_lib/riot.mjs';

function readGameId(value) {
  const gameId = String(value || '').trim().toUpperCase();
  if (!/^([A-Z0-9]+)_\d+$/.test(gameId)) {
    throw Object.assign(new Error('Game ID invalide. Format attendu : EUW1_7123456789.'), {
      status: 400,
      code: 'NXT5_EXPORT_GAME_ID_INVALID'
    });
  }
  return gameId;
}

export default async function handler(request) {
  try {
    if (!['GET', 'POST'].includes(request.method)) {
      throw Object.assign(new Error(`Méthode ${request.method} refusée. GET ou POST attendu.`), { status: 405 });
    }

    const url = new URL(request.url);
    const body = request.method === 'POST' ? await readJson(request) : {};
    const gameId = readGameId(url.searchParams.get('gameId') || body.gameId);
    const match = await fetchRiotMatch(gameId);

    return json({
      source: 'nxt5-riot-match-export',
      version: 1,
      gameId,
      platform: gameId.split('_')[0],
      exportedAt: new Date().toISOString(),
      match
    });
  } catch (err) {
    return handleError(err);
  }
}
