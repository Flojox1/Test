import { getFirebaseApp, getFirebaseAuth } from './firebase.js';

// Cloudflare Worker deploy edildikten sonra workers.dev adresini buraya yaz.
const AUTH_WORKER_URL = 'https://email.akar4dogukan.workers.dev';

async function callWorker(path, data = {}) {
  const auth = await getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('Oturum bulunamadı. Tekrar giriş yap.');
  const token = await user.getIdToken(true);
  const response = await fetch(`${AUTH_WORKER_URL}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    const error = new Error(payload.error || 'İşlem tamamlanamadı.');
    error.code = `worker/${response.status}`;
    throw error;
  }
  return payload;
}

export async function registerWithEmail(email, password) {
  const app = await getFirebaseApp();
  const { getAuth, createUserWithEmailAndPassword, signOut } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
  const auth = getAuth(app);
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  try { await callWorker('send-code'); }
  catch (error) { await signOut(auth); throw error; }
  return credential.user;
}

export async function verifyEmailCode(code) {
  const result = await callWorker('verify-code', { code: String(code).trim() });
  const auth = await getFirebaseAuth();
  if (auth.currentUser) {
    // Worker emailVerified bilgisini sunucuda güncelledi. Önce kullanıcı
    // kaydını, ardından RTDB kurallarının kullandığı ID token'ı yenile.
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true);
  }
  return result;
}

export async function resendVerificationCode() {
  return callWorker('send-code');
}

export async function loginWithEmail(email, password) {
  const auth = await getFirebaseAuth();
  const { signInWithEmailAndPassword, reload } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  await reload(credential.user);
  if (!credential.user.emailVerified) {
    const err = new Error('E-posta adresin henüz doğrulanmamış. Aşağıdan doğrulama kodu iste.');
    err.code = 'auth/email-not-verified';
    throw err;
  }
  return credential.user;
}

export async function resetPassword(email) {
  const auth = await getFirebaseAuth();
  const { sendPasswordResetEmail } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
  await sendPasswordResetEmail(auth, email.trim());
}

export async function requireVerifiedUser() {
  const auth = await getFirebaseAuth();
  const { onAuthStateChanged, signOut } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
  return new Promise((resolve, reject) => {
    const stop = onAuthStateChanged(auth, async user => {
      stop();
      if (!user) return resolve(null);
      try { await user.reload(); } catch (e) {}
      if (!user.emailVerified) {
        await signOut(auth);
        return resolve(null);
      }
      resolve(user);
    }, reject);
  });
}
