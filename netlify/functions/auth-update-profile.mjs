import { sql } from './_lib/db.mjs';
import { json, readJson, assertMethod, handleError } from './_lib/http.mjs';
import { isValidEmail, normalizeEmail, requireAuth, safeUser } from './_lib/auth.mjs';

export default async function handler(request, context) {
  try {
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request);
    const name = String(body.name || '').trim().replace(/\s+/g, ' ');
    const email = normalizeEmail(body.email);

    if (name.length < 3 || name.length > 32) {
      throw Object.assign(new Error('Le pseudo doit faire entre 3 et 32 caractères.'), { status: 400 });
    }
    if (!isValidEmail(email) || email.length > 160) {
      throw Object.assign(new Error('Adresse e-mail invalide.'), { status: 400 });
    }

    const rows = await sql`
      update users
      set name = ${name},
          email = ${email},
          updated_at = now()
      where id = ${user.id}
      returning id, account_name, email, name, created_at
    `;

    await sql`
      insert into audit_logs (user_id, action, entity_type, metadata)
      values (${user.id}, 'auth.profile_update', 'user', ${JSON.stringify({ name, email })}::jsonb)
    `;

    return json({ user: safeUser(rows[0]) });
  } catch (err) {
    if (String(err.message || '').includes('idx_users_email_lower')) err.message = 'Cet e-mail est déjà utilisé.';
    return handleError(err);
  }
}
