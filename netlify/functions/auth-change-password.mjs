import { sql } from './_lib/db.mjs';
import { json, readJson, assertMethod, handleError } from './_lib/http.mjs';
import { hashPassword, requireAuth, verifyPassword } from './_lib/auth.mjs';

export default async function handler(request, context) {
  try {
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request);
    const currentPassword = String(body.currentPassword || '');
    const nextPassword = String(body.nextPassword || '');

    if (!currentPassword || !nextPassword) {
      throw Object.assign(new Error('Mot de passe actuel et nouveau mot de passe requis.'), { status: 400 });
    }
    if (nextPassword.length < 8) {
      throw Object.assign(new Error('Le nouveau mot de passe doit faire au moins 8 caractères.'), { status: 400 });
    }
    if (currentPassword === nextPassword) {
      throw Object.assign(new Error('Le nouveau mot de passe doit être différent de l’ancien.'), { status: 400 });
    }

    const rows = await sql`select password_hash from users where id = ${user.id} limit 1`;
    const passwordHash = rows[0]?.password_hash;
    const passwordOk = passwordHash ? await verifyPassword(currentPassword, passwordHash) : false;
    if (!passwordOk) {
      throw Object.assign(new Error('Mot de passe actuel incorrect.'), { status: 401 });
    }

    const nextPasswordHash = await hashPassword(nextPassword);
    await sql`
      update users
      set password_hash = ${nextPasswordHash},
          updated_at = now()
      where id = ${user.id}
    `;

    await sql`
      insert into audit_logs (user_id, action, entity_type, metadata)
      values (${user.id}, 'auth.password_change', 'user', ${JSON.stringify({})}::jsonb)
    `;

    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
