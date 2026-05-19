import { sql } from './_lib/db.mjs';
import { json, readJson, assertMethod, handleError } from './_lib/http.mjs';
import { createSession, hashPassword, isValidEmail, normalizeAccountName, normalizeEmail, safeUser } from './_lib/auth.mjs';

function accountNameFromEmail(email) {
  const base = normalizeAccountName(email.split('@')[0]).replace(/[^a-z0-9._-]/g, '').slice(0, 18) || 'compte';
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

export default async function handler(request, context) {
  try {
    assertMethod(request, 'POST');
    const body = await readJson(request);
    const email = normalizeEmail(body.email);
    const displayName = String(body.displayName || '').trim().replace(/\s+/g, ' ');
    const password = String(body.password || '');

    if (!email || !displayName || !password) {
      throw Object.assign(new Error('E-mail, pseudo et mot de passe requis.'), { status: 400 });
    }
    if (displayName.length < 3 || displayName.length > 32) {
      throw Object.assign(new Error('Le pseudo doit faire entre 3 et 32 caractères.'), { status: 400 });
    }
    if (!isValidEmail(email) || email.length > 160) {
      throw Object.assign(new Error('Adresse e-mail invalide.'), { status: 400 });
    }
    if (password.length < 8) {
      throw Object.assign(new Error('Mot de passe trop court : 8 caractères minimum.'), { status: 400 });
    }

    const accountName = accountNameFromEmail(email);
    const passwordHash = await hashPassword(password);
    const users = await sql`
      insert into users (account_name, email, name, password_hash)
      values (${accountName}, ${email}, ${displayName}, ${passwordHash})
      returning id, account_name, email, name, created_at
    `;

    const user = users[0];

    await sql`
      insert into audit_logs (user_id, action, entity_type, metadata)
      values (${user.id}, 'auth.register', 'user', ${JSON.stringify({ email, displayName })}::jsonb)
    `;

    await createSession({ userId: user.id, context, request });
    return json({ user: safeUser(user) });
  } catch (err) {
    if (String(err.message || '').includes('idx_users_email_lower')) err.message = 'Cet e-mail est déjà utilisé.';
    else if (String(err.message || '').includes('duplicate key')) err.message = 'Ce compte existe déjà.';
    return handleError(err);
  }
}
