import { requireVerifiedUser } from './auth.js';
import { init } from './game.js';

try {
  const user = await requireVerifiedUser();
  if (!user) {
    window.location.replace('index.html');
  } else {
    document.documentElement.dataset.accountEmail = user.email || '';
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
