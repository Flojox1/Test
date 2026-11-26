import { firebaseConfig, chatEnabled } from './config.js';

let appInstance = null;
export function getFirebaseApp() {
  if (!chatEnabled) throw new Error('Firebase yapılandırılmamış. js/config.js dosyasını doldur.');
  if (!appInstance) {
    // Aynı sayfada modüller arasında tek Firebase App örneği kullanılır.
    appInstance = import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js')
      .then(({ initializeApp, getApps, getApp }) => getApps().length ? getApp() : initializeApp(firebaseConfig));
  }
  return appInstance;
}

export async function getFirebaseAuth() {
  const app = await getFirebaseApp();
  const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
  return getAuth(app);
}
