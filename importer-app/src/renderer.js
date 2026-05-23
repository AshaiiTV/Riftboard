const form = document.querySelector('#form');
const submit = document.querySelector('#submit');
const statusBox = document.querySelector('#status');
let generating = false;

function setStatus(type, text) {
  statusBox.hidden = false;
  statusBox.className = `status ${type}`;
  statusBox.textContent = text;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (generating) return;
  generating = true;
  submit.disabled = true;
  submit.textContent = 'Generation...';
  setStatus('info', 'Connexion a NXT5 et preparation du JSON complet...');

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  try {
    const result = await window.nxt5.generateImport(payload);
    if (result.canceled) setStatus('info', 'Sauvegarde annulee. Aucun fichier cree.');
    else setStatus('success', `JSON complet pret : ${result.filePath}`);
  } catch (err) {
    setStatus('error', err.message || 'Erreur inconnue pendant la generation.');
  } finally {
    generating = false;
    submit.disabled = false;
    submit.textContent = 'Generer le JSON complet';
  }
});
