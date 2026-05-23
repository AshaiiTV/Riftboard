import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NXT5_SITE_URL = String(process.env.NXT5_SITE_URL || 'https://nxt5.netlify.app').replace(/\/+$/, '');

function normalizeGameId(value, platform = 'EUW1') {
  const raw = String(value || '').trim().toUpperCase();
  const normalizedPlatform = String(platform || 'EUW1').trim().toUpperCase();
  const gameId = raw.includes('_') ? raw : `${normalizedPlatform}_${raw}`;
  if (!/^([A-Z0-9]+)_\d+$/.test(gameId)) {
    throw new Error('Game ID invalide. Mets un ID numerique comme 7861632138, ou complet comme EUW1_7861632138.');
  }
  return gameId;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1040,
    height: 760,
    minWidth: 880,
    minHeight: 660,
    title: 'NXT5 Importer',
    backgroundColor: '#030713',
    icon: path.join(__dirname, '..', 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.icns'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, 'renderer.html'));
}

ipcMain.handle('generate-import', async (_event, form) => {
  const gameId = normalizeGameId(form?.gameId, form?.platform);
  const label = String(form?.label || '').trim().slice(0, 120);
  const opponent = String(form?.opponent || '').trim().slice(0, 120);
  const exportUrl = `${NXT5_SITE_URL}/.netlify/functions/riot-match-export?gameId=${encodeURIComponent(gameId)}`;
  const response = await fetch(exportUrl);
  let exported = null;
  try {
    exported = await response.json();
  } catch {
    exported = null;
  }

  if (!response.ok) {
    throw new Error(exported?.error || `NXT5 refuse l'export (${response.status}). Verifie le Game ID ou la cle Riot cote Netlify.`);
  }
  if (!exported?.match?.info?.participants || !exported?.match?.info?.teams) {
    throw new Error('NXT5 a repondu, mais le JSON Riot est incomplet. Reessaie dans quelques instants.');
  }

  const payload = {
    source: 'nxt5-importer-app',
    version: 2,
    gameId,
    platform: gameId.split('_')[0],
    label,
    opponent,
    exportedAt: new Date().toISOString(),
    match: exported.match
  };

  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Enregistrer le JSON NXT5',
    defaultPath: `nxt5-${gameId}.json`,
    filters: [{ name: 'NXT5 JSON', extensions: ['json'] }]
  });
  if (canceled || !filePath) return { canceled: true };

  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
  return { canceled: false, filePath, gameId };
});

app.setName('NXT5 Importer');
app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
