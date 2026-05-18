import { json, handleError } from './_lib/http.mjs';

export default async function handler(request) {
  try {
    if (!['POST', 'GET'].includes(request.method)) {
      return json({ error: 'Méthode non autorisée.' }, 405);
    }
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
