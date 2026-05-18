import { sql } from './_lib/db.mjs';
import { json, readJson, assertMethod, handleError } from './_lib/http.mjs';
import { requireAuth } from './_lib/auth.mjs';
import { createTournamentCode, platformFromRegion } from './_lib/riot.mjs';
import { canManageTournamentCodes, cleanTournamentText, ensureTournamentCodesTable } from './_lib/tournament-codes.mjs';

export default async function handler(request, context) {
  try {
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request);
    const action = cleanTournamentText(body.action || 'create', 24);
    const teamId = cleanTournamentText(body.teamId, 80);
    const codeId = cleanTournamentText(body.codeId, 80);
    const label = cleanTournamentText(body.label, 120);
    const opponent = cleanTournamentText(body.opponent, 120) || null;
    const platform = platformFromRegion(body.platform || 'EUW1');

    if (!teamId) throw Object.assign(new Error('Team requise.'), { status: 400 });
    const allowed = await canManageTournamentCodes(user.id, teamId);
    if (!allowed) throw Object.assign(new Error('Seul l’owner, un capitaine ou un coach peut gérer les codes tournoi.'), { status: 403 });

    await ensureTournamentCodesTable();

    if (action === 'delete') {
      if (!codeId) throw Object.assign(new Error('Code tournoi requis.'), { status: 400 });
      const deleted = await sql`
        delete from tournament_codes
        where id = ${codeId}
          and team_id = ${teamId}
        returning *
      `;
      if (!deleted[0]) throw Object.assign(new Error('Code tournoi introuvable.'), { status: 404 });
      await sql`
        insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        values (${user.id}, 'tournament_codes.delete', 'tournament_codes', ${codeId}, ${JSON.stringify({ teamId, label: deleted[0].label })}::jsonb)
      `;
      return json({ ok: true });
    }

    let code = cleanTournamentText(body.code, 128).toUpperCase();
    let sourceAction = 'tournament_codes.create';
    if (action === 'generate') {
      const generated = await createTournamentCode({ platform, metadata: JSON.stringify({ teamId, label, opponent, app: 'RiftBoard' }) });
      code = String(Array.isArray(generated) ? generated[0] : generated || '').trim().toUpperCase();
      sourceAction = 'tournament_codes.generate';
    }

    if (!label) throw Object.assign(new Error('Nom du code requis.'), { status: 400 });
    if (!code) throw Object.assign(new Error('Code tournoi requis.'), { status: 400 });

    const rows = await sql`
      insert into tournament_codes (team_id, created_by, label, opponent, code, platform, status)
      values (${teamId}, ${user.id}, ${label}, ${opponent}, ${code}, ${platform}, 'ready')
      on conflict (team_id, code)
      do update set label = excluded.label,
                    opponent = excluded.opponent,
                    platform = excluded.platform,
                    updated_at = now()
      returning *
    `;

    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, ${sourceAction}, 'tournament_codes', ${rows[0].id}, ${JSON.stringify({ teamId, label, opponent, platform })}::jsonb)
    `;

    return json({ tournamentCode: rows[0] });
  } catch (err) {
    return handleError(err);
  }
}
