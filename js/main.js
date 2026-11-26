import { requireVerifiedUser } from './auth.js';
import { init } from './game.js';
import { getFirebaseApp, getFirebaseAuth } from './firebase.js';

function choosePlayerName() {
  const back = document.getElementById('nameSetupBack');
  const form = document.getElementById('nameSetupForm');
  const input = document.getElementById('playerNameInput');
  const error = document.getElementById('nameSetupError');
  const submit = document.getElementById('nameSetupSubmit');

  back.classList.add('open');
  back.setAttribute('aria-hidden', 'false');
  input.focus();

  return new Promise(resolve => {
    const onSubmit = event => {
      event.preventDefault();
      const name = input.value.trim().replace(/\\s+/g, ' ');
      if (name.length < 2 || name.length > 20) {
        error.textContent = 'Kullanıcı adı 2-20 karakter arasında olmalı.';
        return;
      }
      form.removeEventListener('submit', onSubmit);
      submit.disabled = true;
      resolve(name);
    };
    form.addEventListener('submit', onSubmit);
  });
}

try {
  const user = await requireVerifiedUser();
  if (!user) {
    window.location.replace('index.html');
  } else {
    const app = await getFirebaseApp();
    const { getDatabase, ref, get, set } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
    const db = getDatabase(app);
    const profileRef = ref(db, `users/${user.uid}/profile`);
    const profileSnap = await get(profileRef);
    let profile = profileSnap.exists() ? profileSnap.val() : {};

    if (!profile?.name || typeof profile.name !== 'string' || !profile.name.trim()) {
      const playerName = await choosePlayerName();
      await set(profileRef, { name: playerName, createdAt: Date.now() });
      profile = { ...profile, name: playerName };
      const setupBack = document.getElementById('nameSetupBack');
      setupBack.classList.remove('open');
      setupBack.setAttribute('aria-hidden', 'true');
    }

    document.getElementById('profileName').textContent = profile.name.trim();
    document.getElementById('profileEmail').textContent = user.email || 'E-posta bulunamadı';

    const profileBack = document.getElementById('profileBack');
    const closeProfile = () => {
      profileBack.classList.remove('open');
      profileBack.setAttribute('aria-hidden', 'true');
    };
    document.getElementById('profileOpen').addEventListener('click', () => {
      profileBack.classList.add('open');
      profileBack.setAttribute('aria-hidden', 'false');
    });
    document.getElementById('profileClose').addEventListener('click', closeProfile);\n    document.getElementById('playerLogout').addEventListener('click', async () => { if (!confirm('Hesabından çıkış yapmak istiyor musun?')) return; const auth = await getFirebaseAuth(); const { signOut } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'); await signOut(auth); window.location.replace('index.html'); });
    profileBack.addEventListener('click', event => {
      if (event.target === profileBack) closeProfile();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeProfile();
    });

    await init(user.uid);
  }
} catch (error) {
  console.error('Oyun başlatılamadı:', error);
  document.body.innerHTML = `
    <main style="max-width:600px;margin:12vh auto;padding:24px;color:#f5f0df;font-family:Arial,sans-serif;background:#171b14;border:1px solid #586044;border-radius:14px">
      <h2>Oyun açılamadı</h2>
      <p>Hesabın açık, ancak profil veya oyun kaydı yüklenirken bir hata oluştu.</p>
      <pre style="white-space:pre-wrap;overflow-wrap:anywhere;color:#ffd28a">${String(error?.message || error)}</pre>
      <button onclick="location.reload()" style="padding:12px 18px;border:0;border-radius:8px">Tekrar dene</button>
      <p style="font-size:13px;color:#aaa">Mevcut bulut kaydına dokunulmadı.</p>
    </main>`;
}
