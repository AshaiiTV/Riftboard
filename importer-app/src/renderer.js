const form = document.querySelector('#form');
const submit = document.querySelector('#submit');
const statusBox = document.querySelector('#status');
let generating = false;

function setStatus(type, text) {
  statusBox.hidden = false;
  statusBox.className = `status ${type}`;
  statusBox.textContent = text;
}

function resetSubmit() {
  generating = false;
  submit.disabled = false;
  submit.textContent = 'Generer le fichier';
}

if (!window.nxt5?.generateImport) {
  submit.disabled = true;
  setStatus('error', "Le moteur local de l'application ne s'est pas charge. Ferme l'app, supprime l'ancienne version, puis ouvre la derniere version de NXT5 Importer.");
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (generating) return;
  if (!window.nxt5?.generateImport) {
    setStatus('error', "Le moteur local de l'application ne repond pas. Telecharge de nouveau NXT5 Importer depuis NXT5, puis remplace l'ancienne app.");
    return;
  }
  if (!form.reportValidity()) return;
  generating = true;
  submit.disabled = true;
  submit.textContent = 'Generation...';
  setStatus('info', 'Recherche de la game et preparation du fichier...');

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  try {
    const result = await window.nxt5.generateImport(payload);
    if (result.canceled) setStatus('info', 'Sauvegarde annulee. Aucun fichier cree.');
    else setStatus('success', `Fichier pret : ${result.filePath}`);
  } catch (err) {
    setStatus('error', err.message || 'Erreur inconnue pendant la generation.');
  } finally {
    resetSubmit();
  }
});
