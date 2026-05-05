import { sql } from './_lib/db.mjs';
import { json, readJson, assertMethod, handleError } from './_lib/http.mjs';
import { normalizeAccountName, requireAuth, safeUser } from './_lib/auth.mjs';

function identityKey(value) {
  return normalizeAccountName(value).replace(/[\s._-]+/g, '');
}

export default async function handler(request, context) {
  try {
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request);
    const name = String(body.name || '').trim().replace(/\s+/g, ' ');

    if (name.length < 3 || name.length > 32) {
      throw Object.assign(new Error('Le pseudo public doit faire entre 3 et 32 caractères.'), { status: 400 });
    }
    if (identityKey(name) === identityKey(user.account_name)) {
      throw Object.assign(new Error('Le pseudo public doit être différent de ton identifiant privé.'), { status: 400 });
    }

    const rows = await sql`
      update users
      set name = ${name},
          updated_at = now()
      where id = ${user.id}
      returning id, account_name, name, created_at
    `;

    await sql`
      insert into audit_logs (user_id, action, entity_type, metadata)
      values (${user.id}, 'auth.profile_update', 'user', ${JSON.stringify({ name })}::jsonb)
    `;

    return json({ user: safeUser(rows[0]) });
  } catch (err) {
    return handleError(err);
  }
}
