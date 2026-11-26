import { requireVerifiedUser } from './auth.js';
import { init } from './game.js';
import { getFirebaseApp } from './firebase.js';

try {
  const user = await requireVerifiedUser();
  if (!user) {
    window.location.replace('index.html');
  } else {
    document.documentElement.dataset.accountEmail = user.email || '';
    const app = await getFirebaseApp();
    const { getDatabase, ref, get, set } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
    const db = getDatabase(app);
    const profileRef = ref(db, `users/${user.uid}/profile`);
    const profileSnap = await get(profileRef);
    if (!profileSnap.exists() || !profileSnap.val()?.name) {
      let playerName = '';
      while (!playerName) {
        const entered = prompt('Oyuna hoş geldin! Kullanacağın oyuncu adını seç (2-20 karakter):');
        if (entered === null) { await (await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js')).signOut(await (await import('./firebase.js')).getFirebaseAuth()); window.location.replace('index.html'); throw new Error('İsim seçimi iptal edildi.'); }
        const cleaned = entered.trim().replace(/\\s+/g, ' ').slice(0, 20);
        if (cleaned.length >= 2) playerName = cleaned;
        else alert('İsim en az 2 karakter olmalı.');
      }
      await set(profileRef, { name: playerName, createdAt: Date.now() });
    }
    await init(user.uid);
  }
} catch (error) {
  console.error('Oyun başlatılamadı:', error);
  // Giriş sayfasına geri atmak yerine gerçek hatayı göster ki kayıt korunarak düzeltilebilsin.
  document.body.innerHTML = `
    <main style="max-width:600px;margin:12vh auto;padding:24px;color:#f5f0df;font-family:Arial,sans-serif;background:#171b14;border:1px solid #586044;border-radius:14px">
      <h2>Oyun açılamadı</h2>
      <p>Hesabın açık, ancak oyun/kayıt yüklenirken bir hata oluştu.</p>
      <pre style="white-space:pre-wrap;overflow-wrap:anywhere;color:#ffd28a">${String(error?.message || error)}</pre>
      <button onclick="location.reload()" style="padding:12px 18px;border:0;border-radius:8px">Tekrar dene</button>
      <p style="font-size:13px;color:#aaa">Mevcut bulut kaydına dokunulmadı.</p>
    </main>`;
}
