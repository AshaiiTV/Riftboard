import { sql } from './_lib/db.mjs';
import { json, readJson, assertMethod, handleError } from './_lib/http.mjs';
import { requireAuth } from './_lib/auth.mjs';

function cleanText(value, max = 4000) {
  return String(value || '').trim().slice(0, max);
}

export default async function handler(request, context) {
  try {
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request);
    const action = cleanText(body.action || 'create', 20);
    const teamId = cleanText(body.teamId, 80);
    const reportId = cleanText(body.reportId, 80);
    const title = cleanText(body.title, 140);
    const content = cleanText(body.content, 12000);
    const matchIds = Array.isArray(body.matchIds) ? body.matchIds.map((id) => cleanText(id, 80)).filter(Boolean).slice(0, 20) : [];

    if (!teamId) throw Object.assign(new Error('Team requise.'), { status: 400 });

    await sql`alter table reports add column if not exists match_ids jsonb not null default '[]'::jsonb`;
    await sql`alter table reports add column if not exists created_by uuid references users(id) on delete set null`;
    await sql`alter table reports add column if not exists updated_at timestamptz not null default now()`;

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
      if (!reportId) throw Object.assign(new Error('Rapport requis.'), { status: 400 });
      const existing = await sql`select * from reports where id = ${reportId} and team_id = ${teamId} limit 1`;
      const report = existing[0];
      if (!report) throw Object.assign(new Error('Rapport introuvable.'), { status: 404 });
      if (String(report.created_by || '') !== String(user.id) && !isCaptain) {
        throw Object.assign(new Error('Seul l’auteur du rapport ou le capitaine peut le supprimer.'), { status: 403 });
      }
      await sql`delete from reports where id = ${reportId} and team_id = ${teamId}`;
      await sql`
        insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        values (${user.id}, 'reports.delete', 'reports', ${reportId}, ${JSON.stringify({ teamId, title: report.title })}::jsonb)
      `;
      return json({ ok: true });
    }

    if (!title || !content) throw Object.assign(new Error('Titre et contenu requis.'), { status: 400 });

    const validMatches = matchIds.length ? await sql`
      select id
      from matches
      where team_id = ${teamId}
        and id = any(${matchIds})
    ` : [];
    const validMatchIds = validMatches.map((match) => match.id);
    const primaryMatchId = validMatchIds[0] || null;

    if (action === 'update') {
      if (!reportId) throw Object.assign(new Error('Rapport requis.'), { status: 400 });
      const existing = await sql`select * from reports where id = ${reportId} and team_id = ${teamId} limit 1`;
      const report = existing[0];
      if (!report) throw Object.assign(new Error('Rapport introuvable.'), { status: 404 });
      if (String(report.created_by || '') !== String(user.id) && !isCaptain) {
        throw Object.assign(new Error('Seul l’auteur du rapport ou le capitaine peut le modifier.'), { status: 403 });
      }
      const rows = await sql`
        update reports
        set match_id = ${primaryMatchId},
            match_ids = ${JSON.stringify(validMatchIds)}::jsonb,
            title = ${title},
            content = ${content},
            updated_at = now()
        where id = ${reportId}
          and team_id = ${teamId}
        returning *
      `;
      await sql`
        insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        values (${user.id}, 'reports.update', 'reports', ${reportId}, ${JSON.stringify({ teamId, title, matchIds: validMatchIds })}::jsonb)
      `;
      return json({ report: rows[0] });
    }

    const rows = await sql`
      insert into reports (team_id, match_id, match_ids, created_by, title, content)
      values (${teamId}, ${primaryMatchId}, ${JSON.stringify(validMatchIds)}::jsonb, ${user.id}, ${title}, ${content})
      returning *
    `;

    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, 'reports.create', 'reports', ${rows[0].id}, ${JSON.stringify({ teamId, title, matchIds: validMatchIds })}::jsonb)
    `;

    return json({ report: rows[0] });
  } catch (err) {
    return handleError(err);
  }
}
