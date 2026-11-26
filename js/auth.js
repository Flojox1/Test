import { getFirebaseApp, getFirebaseAuth } from './firebase.js';

export async function registerWithEmail(email, password) {
  const app = await getFirebaseApp();
  const { getAuth, createUserWithEmailAndPassword, sendEmailVerification } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
  const auth = getAuth(app);
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await sendEmailVerification(credential.user);
  await auth.signOut();
  return true;
}

export async function loginWithEmail(email, password) {
  const auth = await getFirebaseAuth();
  const { signInWithEmailAndPassword, signOut, reload } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  await reload(credential.user);
  if (!credential.user.emailVerified) {
    await signOut(auth);
    const err = new Error('E-posta adresin henüz doğrulanmamış. Gelen kutunu kontrol et.');
    err.code = 'auth/email-not-verified';
    throw err;
  }
  return credential.user;
}

export async function resendVerification(email, password) {
  const auth = await getFirebaseAuth();
  const { signInWithEmailAndPassword, sendEmailVerification, signOut } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  await sendEmailVerification(credential.user);
  await signOut(auth);
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
