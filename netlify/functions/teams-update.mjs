import { sql } from './_lib/db.mjs';
import { json, readJson, assertMethod, handleError } from './_lib/http.mjs';
import { requireAuth } from './_lib/auth.mjs';

function cleanText(value, max = 80) {
  return String(value || '').trim().slice(0, max);
}

function cleanNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export default async function handler(request, context) {
  try {
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request);

    const teamId = cleanText(body.teamId);
    const name = cleanText(body.name);
    const tag = cleanText(body.tag, 12).toUpperCase();
    const avatarDataUrl = cleanText(body.avatarDataUrl, 1_500_000) || null;
    const avatarZoom = Math.min(2.5, Math.max(1, cleanNumber(body.avatarZoom, 1)));
    const avatarX = Math.min(100, Math.max(0, cleanNumber(body.avatarX, 50)));
    const avatarY = Math.min(100, Math.max(0, cleanNumber(body.avatarY, 50)));

    if (!teamId || !name || !tag) throw Object.assign(new Error('Nom, tag et team requis.'), { status: 400 });
    if (avatarDataUrl && !avatarDataUrl.startsWith('data:image/')) {
      throw Object.assign(new Error('Avatar invalide.'), { status: 400 });
    }

    await sql`alter table teams add column if not exists avatar_data_url text`;
    await sql`alter table teams add column if not exists avatar_zoom numeric not null default 1`;
    await sql`alter table teams add column if not exists avatar_x numeric not null default 50`;
    await sql`alter table teams add column if not exists avatar_y numeric not null default 50`;

    const allowed = await sql`
      select teams.id
      from teams
      left join team_members on team_members.team_id = teams.id and team_members.user_id = ${user.id}
      where teams.id = ${teamId}
        and (teams.owner_id = ${user.id} or team_members.role in ('captain', 'coach'))
      limit 1
    `;
    if (!allowed[0]) throw Object.assign(new Error('Tu ne peux pas modifier cette team.'), { status: 403 });

    const rows = await sql`
      update teams
      set name = ${name},
          tag = ${tag},
          avatar_data_url = ${avatarDataUrl},
          avatar_zoom = ${avatarZoom},
          avatar_x = ${avatarX},
          avatar_y = ${avatarY},
          updated_at = now()
      where id = ${teamId}
      returning *
    `;

    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, 'team.update', 'team', ${teamId}, ${JSON.stringify({ name, tag, avatar: Boolean(avatarDataUrl) })}::jsonb)
    `;

    return json({ team: rows[0] });
  } catch (err) {
    return handleError(err);
  }
}
