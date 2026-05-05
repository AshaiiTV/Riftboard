import { sql } from './_lib/db.mjs';
import { json, readJson, assertMethod, handleError } from './_lib/http.mjs';
import { createSession, hashPassword, normalizeAccountName, safeUser } from './_lib/auth.mjs';

function identityKey(value) {
  return normalizeAccountName(value).replace(/[\s._-]+/g, '');
}

export default async function handler(request, context) {
  try {
    assertMethod(request, 'POST');
    const body = await readJson(request);
    const accountName = normalizeAccountName(body.accountName);
    const displayName = String(body.displayName || '').trim().replace(/\s+/g, ' ');
    const password = String(body.password || '');

    if (!accountName || !displayName || !password) {
      throw Object.assign(new Error('Identifiant privé, pseudo public et mot de passe requis.'), { status: 400 });
    }
    if (accountName.length < 3 || accountName.length > 24) {
      throw Object.assign(new Error('L’identifiant privé doit faire entre 3 et 24 caractères.'), { status: 400 });
    }
    if (displayName.length < 3 || displayName.length > 32) {
      throw Object.assign(new Error('Le pseudo public doit faire entre 3 et 32 caractères.'), { status: 400 });
    }
    if (!/^[a-z0-9._-]+$/.test(accountName)) {
      throw Object.assign(new Error('Identifiant privé invalide : lettres, chiffres, point, tiret et underscore uniquement.'), { status: 400 });
    }
    if (identityKey(displayName) === identityKey(accountName)) {
      throw Object.assign(new Error('Le pseudo public doit être différent de l’identifiant privé.'), { status: 400 });
    }
    if (password.length < 8) {
      throw Object.assign(new Error('Mot de passe trop court : 8 caractères minimum.'), { status: 400 });
    }

    const passwordHash = await hashPassword(password);
    const users = await sql`
      insert into users (account_name, name, password_hash)
      values (${accountName}, ${displayName}, ${passwordHash})
      returning id, account_name, name, created_at
    `;

    const user = users[0];

    await sql`
      insert into audit_logs (user_id, action, entity_type, metadata)
      values (${user.id}, 'auth.register', 'user', ${JSON.stringify({ accountName, displayName })}::jsonb)
    `;

    await createSession({ userId: user.id, context, request });
    return json({ user: safeUser(user) });
  } catch (err) {
    if (String(err.message || '').includes('duplicate key')) err.message = 'Cet identifiant privé est déjà utilisé.';
    return handleError(err);
  }
}
