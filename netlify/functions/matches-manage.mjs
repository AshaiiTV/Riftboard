import { sql } from './_lib/db.mjs';
import { json, readJson, assertMethod, handleError } from './_lib/http.mjs';
import { requireAuth } from './_lib/auth.mjs';

function cleanText(value, max = 240) {
  return String(value || '').trim().slice(0, max);
}

async function ensureMatchManagementColumns() {
  await sql`alter table matches add column if not exists created_by uuid references users(id) on delete set null`;
  await sql`create index if not exists idx_matches_created_by on matches(created_by)`;
}

function removeIdFromJsonArray(value, id) {
  const items = Array.isArray(value) ? value : [];
  return items.filter((item) => String(item) !== String(id));
}

export default async function handler(request, context) {
  try {
    assertMethod(request, 'POST');
    await ensureMatchManagementColumns();
    const user = await requireAuth(request, context);
    const body = await readJson(request);
    const action = cleanText(body.action || 'update', 20);
    const teamId = cleanText(body.teamId, 80);
    const matchId = cleanText(body.matchId, 80);
    const label = cleanText(body.label, 140);
    const opponent = cleanText(body.opponent, 140);

    if (!teamId || !matchId) throw Object.assign(new Error('Team et game requises.'), { status: 400 });

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
    const elevated = member.owner_id === user.id || ['captain', 'coach'].includes(String(member.role || '').toLowerCase());

    const existing = await sql`
      select *
      from matches
      where id = ${matchId}
        and team_id = ${teamId}
      limit 1
    `;
    const match = existing[0];
    if (!match) throw Object.assign(new Error('Game introuvable.'), { status: 404 });
    const isCreator = String(match.created_by || '') === String(user.id);
    if (!elevated && !isCreator) {
      throw Object.assign(new Error('Seul l’intégrateur, le capitaine ou le coach peut modifier cet import.'), { status: 403 });
    }

    if (action === 'delete') {
      const archives = await sql`select * from match_archives where team_id = ${teamId}`;
      for (const archive of archives) {
        const nextIds = removeIdFromJsonArray(archive.match_ids, matchId);
        if (!nextIds.length) {
          await sql`delete from match_archives where id = ${archive.id} and team_id = ${teamId}`;
        } else if (nextIds.length !== archive.match_ids.length) {
          await sql`
            update match_archives
            set match_ids = ${JSON.stringify(nextIds)}::jsonb,
                updated_at = now()
            where id = ${archive.id}
              and team_id = ${teamId}
          `;
        }
      }

      await sql`delete from reports where team_id = ${teamId} and match_id = ${matchId}`;
      const reports = await sql`select * from reports where team_id = ${teamId}`;
      for (const report of reports) {
        const nextIds = removeIdFromJsonArray(report.match_ids, matchId);
        if (nextIds.length !== report.match_ids.length) {
          await sql`
            update reports
            set match_ids = ${JSON.stringify(nextIds)}::jsonb,
                updated_at = now()
            where id = ${report.id}
              and team_id = ${teamId}
          `;
        }
      }

      await sql`delete from match_raw_archives where team_id = ${teamId} and match_id = ${matchId}`;
      await sql`delete from matches where id = ${matchId} and team_id = ${teamId}`;
      await sql`
        insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        values (${user.id}, 'matches.delete', 'match', ${matchId}, ${JSON.stringify({ teamId, gameId: match.game_id })}::jsonb)
      `;
      return json({ ok: true });
    }

    if (!label && !opponent) throw Object.assign(new Error('Nom ou adversaire requis.'), { status: 400 });
    const displayName = opponent || label || match.opponent || match.game_id;
    const rows = await sql`
      update matches
      set opponent = ${displayName},
          raw = jsonb_set(coalesce(raw, '{}'::jsonb), '{nxt5Label}', to_jsonb(${label || displayName}::text), true)
      where id = ${matchId}
        and team_id = ${teamId}
      returning *
    `;
    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, 'matches.update', 'match', ${matchId}, ${JSON.stringify({ teamId, label, opponent: displayName })}::jsonb)
    `;

    return json({ match: rows[0] });
  } catch (err) {
    return handleError(err);
  }
}
