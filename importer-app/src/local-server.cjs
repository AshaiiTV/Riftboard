const http = require('node:http');
const { exec } = require('node:child_process');

const DEFAULT_PORT = Number(process.env.PORT || 5315);
const MAX_PORT_TRIES = 12;

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', ...headers });
  res.end(body);
}

function openBrowser(url) {
  const command = process.platform === 'win32'
    ? `start "" "${url}"`
    : process.platform === 'darwin'
      ? `open "${url}"`
      : `xdg-open "${url}"`;
  exec(command, () => {});
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 2_000_000) {
        reject(new Error('Payload trop lourd.'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function html(error = '') {
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>NXT5 Importer</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; overflow: hidden; background: radial-gradient(circle at 18% 0%, rgba(34,211,238,.30), transparent 34%), radial-gradient(circle at 84% 6%, rgba(217,70,239,.28), transparent 32%), linear-gradient(135deg, #02040d, #071123 52%, #02030a); color: #f8fafc; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    body::before { content: ""; position: fixed; inset: 0; pointer-events: none; background-image: linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px); background-size: 38px 38px; mask-image: radial-gradient(circle at center, black, transparent 78%); }
    body::after { content: ""; position: fixed; left: -15vw; top: 28vh; width: 130vw; height: 1px; transform: rotate(-12deg); background: linear-gradient(90deg, transparent, rgba(103,232,249,.95), rgba(217,70,239,.78), transparent); box-shadow: 0 0 34px rgba(34,211,238,.75); opacity: .65; }
    main { position: relative; width: min(92vw, 860px); border: 1px solid rgba(34,211,238,.26); border-radius: 32px; padding: 34px; background: linear-gradient(135deg, rgba(5,9,20,.94), rgba(8,10,26,.90)); box-shadow: 0 0 90px rgba(34,211,238,.22), 0 28px 90px rgba(0,0,0,.55); backdrop-filter: blur(18px); clip-path: polygon(0 0, calc(100% - 24px) 0, 100% 24px, 100% 100%, 24px 100%, 0 calc(100% - 24px)); }
    main::before { content: ""; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(135deg, rgba(255,255,255,.11), transparent 32%, transparent 72%, rgba(34,211,238,.10)); }
    main::after { content: ""; position: absolute; inset: 12px; pointer-events: none; border: 1px solid rgba(255,255,255,.055); clip-path: polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 18px 100%, 0 calc(100% - 18px)); }
    .content { position: relative; z-index: 2; }
    .top { display: flex; align-items: center; justify-content: space-between; gap: 22px; }
    h1 { margin: 0; transform: skewX(-10deg); font-family: Impact, "Arial Black", Inter, sans-serif; font-size: clamp(42px, 7vw, 86px); line-height: .82; letter-spacing: .08em; text-transform: uppercase; background: linear-gradient(90deg, #fff, #9feeff 38%, #8a73ff 68%, #ff4ddd); -webkit-background-clip: text; background-clip: text; color: transparent; text-shadow: 0 0 30px rgba(34,211,238,.22); }
    .mark { position: relative; display: grid; place-items: center; width: 112px; height: 112px; border: 1px solid rgba(34,211,238,.42); border-radius: 28px; color: #67e8f9; font-size: 74px; font-weight: 1000; background: linear-gradient(135deg, rgba(34,211,238,.14), rgba(217,70,239,.20)); box-shadow: 0 0 70px rgba(34,211,238,.30); clip-path: polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 18px 100%, 0 calc(100% - 18px)); }
    .mark::after { content: "JSON"; position: absolute; right: -10px; top: -8px; border: 1px solid rgba(217,70,239,.38); border-radius: 12px; padding: 5px 8px; background: rgba(217,70,239,.16); color: #fdf4ff; font-size: 10px; letter-spacing: .18em; }
    p { color: #cbd5e1; line-height: 1.75; font-weight: 750; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
    .chip { border: 1px solid rgba(255,255,255,.12); border-radius: 999px; padding: 8px 10px; background: rgba(255,255,255,.045); color: #dff9ff; font-size: 11px; font-weight: 1000; letter-spacing: .13em; text-transform: uppercase; }
    label { display: block; margin-top: 16px; }
    label span { display: block; margin-bottom: 8px; color: #b9c6d8; font-size: 11px; font-weight: 1000; letter-spacing: .22em; text-transform: uppercase; }
    input { width: 100%; border: 1px solid rgba(255,255,255,.14); border-radius: 18px; padding: 16px 17px; color: white; background: rgba(2,6,23,.58); outline: none; font-size: 15px; font-weight: 850; box-shadow: inset 0 1px 0 rgba(255,255,255,.04); }
    input:focus { border-color: rgba(34,211,238,.72); box-shadow: 0 0 0 4px rgba(34,211,238,.12), 0 0 28px rgba(34,211,238,.12); }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    button { width: 100%; margin-top: 22px; border: 1px solid rgba(255,255,255,.18); border-radius: 18px; padding: 18px; color: #fff; background: linear-gradient(135deg, #06b6d4, #2563eb 45%, #d946ef); font-weight: 1000; letter-spacing: .18em; text-transform: uppercase; cursor: pointer; box-shadow: 0 0 36px rgba(34,211,238,.28); transition: transform .18s ease, filter .18s ease, box-shadow .18s ease; }
    button:hover { transform: translateY(-2px); filter: saturate(1.28); box-shadow: 0 0 52px rgba(217,70,239,.26); }
    .error { margin-top: 18px; border: 1px solid rgba(251,113,133,.34); border-radius: 18px; padding: 15px 16px; color: #ffe4e6; background: rgba(244,63,94,.14); font-weight: 900; line-height: 1.5; }
    code { color: #67e8f9; }
    @media (max-width: 680px) { body { overflow: auto; } .top, .grid { display: block; } .mark { width: 88px; height: 88px; font-size: 56px; } main { padding: 24px; } }
  </style>
</head>
<body>
  <main>
    <div class="content">
      <div class="top">
        <div>
          <h1>NXT5 Importer</h1>
          <p>Colle un Game ID Riot ou un code tournoi, puis génère un fichier JSON prêt à importer dans NXT5. Aucune clé Riot n'est demandée ici.</p>
          <div class="chips"><span class="chip">No key</span><span class="chip">Local JSON</span><span class="chip">Next Five</span></div>
        </div>
        <div class="mark">5</div>
      </div>
      <form method="post" action="/export">
        <label><span>Game ID ou code tournoi</span><input name="gameId" placeholder="EUW1_7123456789 ou code tournoi" required /></label>
        <div class="grid">
          <label><span>Nom de l'import</span><input name="label" placeholder="Scrim, tournoi, round..." /></label>
          <label><span>Adversaire</span><input name="opponent" placeholder="Equipe adverse" /></label>
        </div>
        <button type="submit">Générer le fichier NXT5</button>
      </form>
      ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
      <p>Ensuite : NXT5 → Intégration → <code>Importer un fichier NXT5 local</code>.</p>
    </div>
  </main>
</body>
</html>`;
}

async function handleExport(req, res) {
  const raw = await readBody(req);
  const params = new URLSearchParams(raw);
  const value = String(params.get('gameId') || '').trim();
  const gameId = value.toUpperCase();
  const label = String(params.get('label') || '').trim();
  const opponent = String(params.get('opponent') || '').trim();
  const isGameId = /^([A-Z0-9]+)_\d+$/i.test(value);

  if (!value) return send(res, 400, html('Colle un Game ID ou un code tournoi avant de générer le fichier.'));
  const payload = {
    source: 'nxt5-importer-exe',
    version: 1,
    gameId: isGameId ? gameId : '',
    tournamentCode: isGameId ? '' : value,
    platform: isGameId ? gameId.split('_')[0].toUpperCase() : 'EUW1',
    label,
    opponent,
    exportedAt: new Date().toISOString()
  };
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': `attachment; filename="nxt5-${isGameId ? gameId : 'code-tournoi'}.json"`
  });
  res.end(JSON.stringify(payload, null, 2));
}

function createServer() {
  return http.createServer(async (req, res) => {
    try {
      if (req.method === 'POST' && req.url === '/export') return await handleExport(req, res);
      return send(res, 200, html());
    } catch (err) {
      return send(res, 500, html(err.message || 'Erreur locale inconnue.'));
    }
  });
}

function startServer(port = DEFAULT_PORT, attempt = 0) {
  const server = createServer();
  server.on('error', (err) => {
    if (err?.code === 'EADDRINUSE' && attempt < MAX_PORT_TRIES) {
      startServer(port + 1, attempt + 1);
      return;
    }
    console.error(`Impossible de lancer NXT5 Importer: ${err?.message || err}`);
    process.exit(1);
  });
  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}`;
    console.log(`NXT5 Importer: ${url}`);
    openBrowser(url);
  });
}

startServer();
