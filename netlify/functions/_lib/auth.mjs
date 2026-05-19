import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { sql } from './db.mjs';

export const COOKIE_NAME = 'rb_session';
const SESSION_DAYS = 14;

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function normalizeAccountName(accountName) {
  return String(accountName || '').trim().toLowerCase();
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

export function safeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    account_name: user.account_name,
    email: user.email || '',
    name: user.name || user.account_name,
    created_at: user.created_at
  };
}

export async function createSession({ userId, context, request }) {
  const rawToken = crypto.randomBytes(48).toString('base64url');
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const userAgent = request.headers.get('user-agent') || '';
  const ip = request.headers.get('x-nf-client-connection-ip') || request.headers.get('x-forwarded-for') || '';

  await sql`
    insert into sessions (user_id, token_hash, expires_at, user_agent, ip)
    values (${userId}, ${tokenHash}, ${expiresAt.toISOString()}, ${userAgent}, ${ip})
  `;

  context.cookies.set({
    name: COOKIE_NAME,
    value: rawToken,
    httpOnly: true,
    secure: process.env.APP_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60
  });
}

export function readSessionCookie(context) {
  const value = context.cookies?.get?.(COOKIE_NAME);
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.value || null;
}

export async function requireAuth(request, context) {
  const token = readSessionCookie(context);
  if (!token) {
    throw Object.assign(new Error('Session absente.'), { status: 401 });
  }

  const tokenHash = sha256(token);
  const rows = await sql`
    select
      sessions.id as session_id,
      users.id,
      users.account_name,
      users.email,
      users.name,
      users.created_at
    from sessions
    join users on users.id = sessions.user_id
    where sessions.token_hash = ${tokenHash}
      and sessions.revoked_at is null
      and sessions.expires_at > now()
    limit 1
  `;

  const user = rows[0];
  if (!user) {
    context.cookies.set({ name: COOKIE_NAME, value: '', path: '/', maxAge: 0, httpOnly: true, secure: process.env.APP_ENV === 'production', sameSite: 'Lax' });
    throw Object.assign(new Error('Session invalide ou expirée.'), { status: 401 });
  }

  return user;
}

export async function revokeSession(context) {
  const token = readSessionCookie(context);
  if (token) {
    await sql`update sessions set revoked_at = now() where token_hash = ${sha256(token)}`;
  }

  context.cookies.set({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.APP_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    maxAge: 0
  });
}
