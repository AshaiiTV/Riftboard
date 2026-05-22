export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

export function error(message, status = 400, code = null) {
  const payload = { error: message };
  if (code) payload.code = code;
  return json(payload, status);
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export function assertMethod(request, method) {
  if (request.method !== method) {
    throw Object.assign(new Error(`Méthode ${request.method} refusée. ${method} attendu.`), { status: 405 });
  }
}

export function handleError(err) {
  console.error(err);
  const payload = { error: err.message || 'Erreur serveur.' };
  if (err.code) payload.code = err.code;
  if (err.retryAfter) payload.retryAfter = err.retryAfter;
  if (err.riotStatus) payload.riotStatus = err.riotStatus;
  if (err.missing) payload.missing = err.missing;
  if (err.details) payload.details = err.details;
  return json(payload, err.status || 500);
}
