import { json, assertMethod, handleError } from './_lib/http.mjs';
import { revokeSession } from './_lib/auth.mjs';

export default async function handler(request, context) {
  try {
    assertMethod(request, 'POST');
    await revokeSession(context, request);
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
