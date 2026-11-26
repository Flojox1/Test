import { getFirebaseApp, getFirebaseAuth } from './firebase.js';

const FUNCTIONS_URL = 'https://europe-west1-chat-f3082.cloudfunctions.net';

async function callFunction(name, data = {}) {
  const auth = await getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('Oturum bulunamadı. Tekrar giriş yap.');
  const token = await user.getIdToken(true);
  const response = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    const error = new Error(payload.error?.message || 'İşlem tamamlanamadı.');
    error.code = payload.error?.status || 'functions/internal';
    throw error;
  }
  return payload.result;
}

export async function registerWithEmail(email, password) {
  const app = await getFirebaseApp();
  const { getAuth, createUserWithEmailAndPassword } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
  const auth = getAuth(app);
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  try { await callFunction('sendVerificationCode'); }
  catch (error) { await auth.signOut(); throw error; }
  return credential.user;
}

export async function verifyEmailCode(code) {
  const result = await callFunction('verifyEmailCode', { code: String(code).trim() });
  const auth = await getFirebaseAuth();
  if (auth.currentUser) await auth.currentUser.reload();
  return result;
}

export async function resendVerificationCode() {
  return callFunction('sendVerificationCode');
}

export async function loginWithEmail(email, password) {
  const auth = await getFirebaseAuth();
  const { signInWithEmailAndPassword, signOut, reload } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  await reload(credential.user);
  if (!credential.user.emailVerified) {
    await signOut(auth);
    const err = new Error('E-posta adresin henüz doğrulanmamış. Kayıt ekranından yeni kod iste.');
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
