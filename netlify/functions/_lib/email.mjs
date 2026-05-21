export function isPasswordEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESET_EMAIL_FROM);
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

export async function sendPasswordResetEmail({ to, name, resetUrl }) {
  if (!isPasswordEmailConfigured()) {
    throw Object.assign(new Error('Envoi e-mail non configuré. Ajoute RESEND_API_KEY et RESET_EMAIL_FROM dans Netlify.'), { status: 500, code: 'EMAIL_NOT_CONFIGURED' });
  }

  const from = process.env.RESET_EMAIL_FROM;
  const subject = 'Réinitialisation de ton mot de passe NXT5';
  const safeName = name || 'joueur';
  const htmlName = escapeHtml(safeName);
  const htmlResetUrl = escapeHtml(resetUrl);

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text: `Salut ${safeName},\n\nTu as demandé à réinitialiser ton mot de passe NXT5.\n\nOuvre ce lien dans les 30 prochaines minutes :\n${resetUrl}\n\nSi tu n'es pas à l'origine de cette demande, ignore simplement cet e-mail.`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;background:#070a13;color:#f8fafc;padding:32px;border-radius:18px">
          <h1 style="margin:0 0 14px;font-size:24px">Réinitialisation NXT5</h1>
          <p>Salut ${htmlName},</p>
          <p>Tu as demandé à réinitialiser ton mot de passe.</p>
          <p><a href="${htmlResetUrl}" style="display:inline-block;background:#00d8ff;color:#020511;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:800">Changer mon mot de passe</a></p>
          <p style="color:#94a3b8;font-size:13px">Ce lien expire dans 30 minutes. Si tu n'es pas à l'origine de cette demande, ignore cet e-mail.</p>
        </div>
      `
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw Object.assign(new Error(`Envoi e-mail impossible.${detail ? ` ${detail}` : ''}`), { status: 502 });
  }
}
