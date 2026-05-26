import { sql } from './_lib/db.mjs';
import { json, readJson, assertMethod, handleError } from './_lib/http.mjs';
import { requireAuth } from './_lib/auth.mjs';

function cleanText(value, max = 4000) {
  return String(value || '').trim().slice(0, max);
}

async function ensureArchiveTable() {
  await sql`
    create table if not exists match_archives (
      id uuid primary key default gen_random_uuid(),
      team_id uuid not null references teams(id) on delete cascade,
      created_by uuid references users(id) on delete set null,
      name text not null,
      description text,
      match_ids jsonb not null default '[]'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await sql`create index if not exists idx_match_archives_team on match_archives(team_id, created_at desc)`;
}

export default async function handler(request, context) {
  try {
    assertMethod(request, 'POST');
    await ensureArchiveTable();
    const user = await requireAuth(request, context);
    const body = await readJson(request);
    const action = cleanText(body.action || 'create', 20);
    const teamId = cleanText(body.teamId, 80);
    const archiveId = cleanText(body.archiveId, 80);
    const name = cleanText(body.name, 140);
    const description = cleanText(body.description, 1000);
    const matchIds = Array.isArray(body.matchIds) ? body.matchIds.map((id) => cleanText(id, 80)).filter(Boolean).slice(0, 80) : [];

    if (!teamId) throw Object.assign(new Error('Team requise.'), { status: 400 });

    const membership = await sql`
      select teams.owner_id, team_members.role
      from teams
      left join team_members on team_members.team_id = teams.id and team_members.user_id = ${user.id}
      where teams.id = ${teamId}
        and (teams.owner_id = ${user.id} or team_members.user_id = ${user.id})
      limit 1
    `;
    const member = membership[0];
    if (!member) throw Object.assign(new Error('Accès team refusé.'), { status: 403 });
    const isCaptain = member.owner_id === user.id || ['captain'].includes(String(member.role || '').toLowerCase());

    if (action === 'delete') {
      if (!archiveId) throw Object.assign(new Error('Archive requise.'), { status: 400 });
      const existing = await sql`select * from match_archives where id = ${archiveId} and team_id = ${teamId} limit 1`;
      const archive = existing[0];
      if (!archive) throw Object.assign(new Error('Archive introuvable.'), { status: 404 });
      if (String(archive.created_by || '') !== String(user.id) && !isCaptain) {
        throw Object.assign(new Error('Seul le créateur ou le capitaine peut supprimer cette archive.'), { status: 403 });
      }
      await sql`delete from match_archives where id = ${archiveId} and team_id = ${teamId}`;
      await sql`
        insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        values (${user.id}, 'match_archives.delete', 'match_archives', ${archiveId}, ${JSON.stringify({ teamId, name: archive.name })}::jsonb)
      `;
      return json({ ok: true });
    }

    if (!name) throw Object.assign(new Error('Nom d’archive requis.'), { status: 400 });
    if (!matchIds.length) throw Object.assign(new Error('Sélectionne au moins une game.'), { status: 400 });

    const validMatches = await sql`
      select id
      from matches
      where team_id = ${teamId}
        and id = any(${matchIds})
    `;
    const validMatchIds = validMatches.map((match) => match.id);
    if (!validMatchIds.length) throw Object.assign(new Error('Aucune game valide pour cette team.'), { status: 400 });

    if (action === 'update') {
      if (!archiveId) throw Object.assign(new Error('Archive requise.'), { status: 400 });
      const existing = await sql`select * from match_archives where id = ${archiveId} and team_id = ${teamId} limit 1`;
      const archive = existing[0];
      if (!archive) throw Object.assign(new Error('Archive introuvable.'), { status: 404 });
      if (String(archive.created_by || '') !== String(user.id) && !isCaptain) {
        throw Object.assign(new Error('Seul le créateur ou le capitaine peut modifier cette archive.'), { status: 403 });
      }
      const rows = await sql`
        update match_archives
        set name = ${name},
            description = ${description || null},
            match_ids = ${JSON.stringify(validMatchIds)}::jsonb,
            updated_at = now()
        where id = ${archiveId}
          and team_id = ${teamId}
        returning *
      `;
      await sql`
        insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        values (${user.id}, 'match_archives.update', 'match_archives', ${archiveId}, ${JSON.stringify({ teamId, name, matchIds: validMatchIds })}::jsonb)
      `;
      return json({ archive: rows[0] });
    }

    const rows = await sql`
      insert into match_archives (team_id, created_by, name, description, match_ids)
      values (${teamId}, ${user.id}, ${name}, ${description || null}, ${JSON.stringify(validMatchIds)}::jsonb)
      returning *
    `;
    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, 'match_archives.create', 'match_archives', ${rows[0].id}, ${JSON.stringify({ teamId, name, matchIds: validMatchIds })}::jsonb)
    `;

    return json({ archive: rows[0] });
  } catch (err) {
    return handleError(err);
  }
}
