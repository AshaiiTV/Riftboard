import { sql } from './_lib/db.mjs';
import { json, readJson, assertMethod, handleError } from './_lib/http.mjs';
import { hashPassword, sha256 } from './_lib/auth.mjs';

export default async function handler(request) {
  try {
    assertMethod(request, 'POST');
    const body = await readJson(request);
    const token = String(body.token || '').trim();
    const nextPassword = String(body.nextPassword || '');

    if (!token || !nextPassword) {
      throw Object.assign(new Error('Lien de réinitialisation et nouveau mot de passe requis.'), { status: 400 });
    }
    if (nextPassword.length < 8) {
      throw Object.assign(new Error('Le nouveau mot de passe doit faire au moins 8 caractères.'), { status: 400 });
    }

    const tokenHash = sha256(token);
    const rows = await sql`
      select password_reset_tokens.id, password_reset_tokens.user_id
      from password_reset_tokens
      where token_hash = ${tokenHash}
        and used_at is null
        and expires_at > now()
      limit 1
    `;
    const reset = rows[0];
    if (!reset) {
      throw Object.assign(new Error('Lien de réinitialisation invalide ou expiré.'), { status: 400 });
    }

    const passwordHash = await hashPassword(nextPassword);
    await sql`
      update users
      set password_hash = ${passwordHash},
          updated_at = now()
      where id = ${reset.user_id}
    `;
    await sql`update password_reset_tokens set used_at = now() where id = ${reset.id}`;
    await sql`update sessions set revoked_at = now() where user_id = ${reset.user_id} and revoked_at is null`;
    await sql`
      insert into audit_logs (user_id, action, entity_type, metadata)
      values (${reset.user_id}, 'auth.password_reset_complete', 'user', ${JSON.stringify({})}::jsonb)
    `;

    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
