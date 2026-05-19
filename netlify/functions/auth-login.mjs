import { sql } from './_lib/db.mjs';
import { json, readJson, assertMethod, handleError } from './_lib/http.mjs';
import { createSession, normalizeAccountName, normalizeEmail, safeUser, verifyPassword } from './_lib/auth.mjs';

export default async function handler(request, context) {
  try {
    assertMethod(request, 'POST');
    const body = await readJson(request);
    const accountName = normalizeAccountName(body.accountName);
    const identifier = accountName.includes('@') ? normalizeEmail(body.accountName) : accountName;
    const password = String(body.password || '');

    const rows = accountName.includes('@')
      ? await sql`select * from users where lower(email) = ${identifier} limit 1`
      : await sql`select * from users where account_name = ${identifier} limit 1`;
    const user = rows[0];
    if (!user) throw Object.assign(new Error('Identifiants incorrects.'), { status: 401 });

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) throw Object.assign(new Error('Identifiants incorrects.'), { status: 401 });

    await createSession({ userId: user.id, context, request });
    return json({ user: safeUser(user) });
  } catch (err) {
    return handleError(err);
  }
}
