// Run locally. Never commit service-account credentials or passwords.
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.applicationDefault() });
async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 12) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters).');
  let user;
  try { user = await admin.auth().getUserByEmail(email); }
  catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    user = await admin.auth().createUser({ email, password, displayName: 'admin', emailVerified: true });
  }
  await admin.auth().updateUser(user.uid, { password, displayName: 'admin', emailVerified: true });
  await admin.auth().setCustomUserClaims(user.uid, { role: 'admin' });
  console.log('Admin role assigned to UID:', user.uid);
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
