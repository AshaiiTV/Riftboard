import { sql } from './_lib/db.mjs';
import { json, readJson, assertMethod, handleError } from './_lib/http.mjs';
import { requireAuth } from './_lib/auth.mjs';

function cleanText(value, max = 160) {
  return String(value || '').trim().slice(0, max);
}

export default async function handler(request, context) {
  try {
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request);
    const action = cleanText(body.action || 'create', 20);
    const teamId = cleanText(body.teamId, 80);
    const compositionId = cleanText(body.compositionId, 80);
    const title = cleanText(body.title, 120);
    const notes = cleanText(body.notes, 500) || null;
    const slots = body.slots && typeof body.slots === 'object' ? body.slots : {};
    const tags = Array.isArray(body.tags) ? body.tags.map((tag) => cleanText(tag, 24)).filter(Boolean).slice(0, 6) : [];

    if (!teamId) throw Object.assign(new Error('Team requise.'), { status: 400 });

    const allowed = await sql`
      select teams.id, teams.owner_id, team_members.role
      from teams
      left join team_members on team_members.team_id = teams.id and team_members.user_id = ${user.id}
      where teams.id = ${teamId}
        and (teams.owner_id = ${user.id} or team_members.user_id = ${user.id})
      limit 1
    `;
    if (!allowed[0]) throw Object.assign(new Error('Tu dois être membre de la team pour gérer les compositions types.'), { status: 403 });
    const role = String(allowed[0].role || '').toLowerCase();
    const canManageAll = allowed[0].owner_id === user.id || ['owner', 'captain', 'coach', 'assistant', 'analyst', 'manager', 'board'].includes(role);

    if (action === 'delete') {
      if (!compositionId) throw Object.assign(new Error('Composition requise.'), { status: 400 });
      const deleted = await sql`
        delete from composition_types
        where id = ${compositionId}
          and team_id = ${teamId}
          and (${canManageAll} or created_by = ${user.id})
        returning *
      `;
      if (!deleted[0]) throw Object.assign(new Error('Composition introuvable ou non autorisée.'), { status: 404 });
      await sql`
        insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        values (${user.id}, 'composition_types.delete', 'composition_types', ${compositionId}, ${JSON.stringify({ teamId, title: deleted[0].title })}::jsonb)
      `;
      return json({ ok: true });
    }

    if (!title) throw Object.assign(new Error('Titre requis.'), { status: 400 });

    if (action === 'update') {
      if (!compositionId) throw Object.assign(new Error('Composition requise.'), { status: 400 });
      const rows = await sql`
        update composition_types
        set title = ${title},
            notes = ${notes},
            tags = ${JSON.stringify(tags)}::jsonb,
            slots = ${JSON.stringify(slots)}::jsonb,
            updated_at = now()
        where id = ${compositionId}
          and team_id = ${teamId}
          and (${canManageAll} or created_by = ${user.id})
        returning *
      `;
      if (!rows[0]) throw Object.assign(new Error('Composition introuvable ou non autorisée.'), { status: 404 });
      await sql`
        insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        values (${user.id}, 'composition_types.update', 'composition_types', ${compositionId}, ${JSON.stringify({ teamId, title })}::jsonb)
      `;
      return json({ composition: rows[0] });
    }

    const rows = await sql`
      insert into composition_types (team_id, created_by, title, notes, tags, slots)
      values (${teamId}, ${user.id}, ${title}, ${notes}, ${JSON.stringify(tags)}::jsonb, ${JSON.stringify(slots)}::jsonb)
      returning *
    `;

    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, 'composition_types.create', 'composition_types', ${rows[0].id}, ${JSON.stringify({ teamId, title })}::jsonb)
    `;

    return json({ composition: rows[0] });
  } catch (err) {
    return handleError(err);
  }
}
