const RELEASE_API = 'https://api.github.com/repos/AshaiiTV/NXT5/releases/tags/nxt5-match-exporter-latest';

function redirect(url) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    }
  });
}

function jsonError(message, status = 404) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

function scoreAsset(asset, platform) {
  const name = String(asset?.name || '').toLowerCase();
  if (!asset?.browser_download_url) return -1;
  if (platform === 'windows' && !name.endsWith('.exe')) return -1;
  if (platform === 'mac' && !name.endsWith('.zip')) return -1;
  if (platform === 'windows' && !name.includes('windows')) return -1;
  if (platform === 'mac' && !name.includes('mac')) return -1;

  let score = 0;
  if (name.includes('nxt5-importer')) score += 100;
  if (name.includes('nxt5-match-exporter')) score += 50;
  if (platform === 'mac' && name.includes('arm64')) score += 20;
  if (name.includes('0.2.1')) score += 10;
  return score;
}

export default async function handler(request) {
  try {
    const url = new URL(request.url);
    const platform = url.searchParams.get('platform') === 'mac' ? 'mac' : 'windows';
    const response = await fetch(RELEASE_API, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'NXT5'
      }
    });
    if (!response.ok) return jsonError('Release NXT5 Importer introuvable.', response.status);

    const release = await response.json();
    const asset = (release.assets || [])
      .map((item) => ({ item, score: scoreAsset(item, platform) }))
      .filter(({ score }) => score >= 0)
      .sort((a, b) => b.score - a.score)[0]?.item;

    if (!asset) return jsonError(`Aucun installateur ${platform === 'mac' ? 'Mac' : 'Windows'} disponible pour le moment.`);
    return redirect(asset.browser_download_url);
  } catch (err) {
    console.error(err);
    return jsonError('Téléchargement temporairement indisponible.', 500);
  }
}
