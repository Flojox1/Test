const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

admin.initializeApp();
const db = admin.database();
const SMTP_HOST = defineSecret('SMTP_HOST');
const SMTP_PORT = defineSecret('SMTP_PORT');
const SMTP_USER = defineSecret('SMTP_USER');
const SMTP_PASS = defineSecret('SMTP_PASS');
const MAIL_FROM = defineSecret('MAIL_FROM');
const CODE_PEPPER = defineSecret('CODE_PEPPER');

function requireUser(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Önce giriş yapmalısın.');
  return request.auth.uid;
}
function codeHash(uid, code, pepper) {
  return crypto.createHmac('sha256', pepper).update(uid + ':' + code).digest('hex');
}
function mailer() {
  const port = Number(SMTP_PORT.value());
  return nodemailer.createTransport({
    host: SMTP_HOST.value(), port, secure: port === 465,
    auth: { user: SMTP_USER.value(), pass: SMTP_PASS.value() }
  });
}

exports.sendVerificationCode = onCall({
  region: 'europe-west1',
  secrets: [SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, CODE_PEPPER],
  maxInstances: 10
}, async request => {
  const uid = requireUser(request);
  const user = await admin.auth().getUser(uid);
  if (!user.email) throw new HttpsError('failed-precondition', 'Hesapta e-posta adresi yok.');
  if (user.emailVerified) throw new HttpsError('already-exists', 'E-posta zaten doğrulanmış.');
  const ref = db.ref('emailVerificationCodes/' + uid);
  const now = Date.now();
  const current = (await ref.get()).val();
  if (current?.sentAt && now - current.sentAt < 60_000) {
    throw new HttpsError('resource-exhausted', 'Yeni kod istemeden önce 60 saniye bekle.');
  }
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await ref.set({ hash: codeHash(uid, code, CODE_PEPPER.value()), expiresAt: now + 300_000, sentAt: now, attempts: 0 });
  try {
    await mailer().sendMail({
      from: MAIL_FROM.value(), to: user.email,
      subject: 'FloRod e-posta doğrulama kodun',
      text: 'FloRod hesabını doğrulamak için kodun: ' + code + '\nBu kod 5 dakika geçerlidir.',
      html: '<div style="font-family:Arial;background:#101014;color:#eee;padding:28px"><h2>FloRod</h2><p>Doğrulama kodun:</p><div style="font-size:32px;letter-spacing:8px;font-weight:bold;padding:18px;background:#08080a">' + code + '</div><p>Bu kod 5 dakika geçerlidir.</p></div>'
    });
  } catch (error) {
    await ref.remove();
    console.error('Verification email failed', error);
    throw new HttpsError('internal', 'E-posta gönderilemedi. SMTP ayarlarını kontrol et.');
  }
  return { sent: true, expiresInSeconds: 300 };
});

exports.verifyEmailCode = onCall({
  region: 'europe-west1', secrets: [CODE_PEPPER], maxInstances: 10
}, async request => {
  const uid = requireUser(request);
  const code = String(request.data?.code || '');
  if (!/^\d{6}$/.test(code)) throw new HttpsError('invalid-argument', '6 haneli kodu gir.');
  const user = await admin.auth().getUser(uid);
  if (user.emailVerified) return { verified: true };
  const ref = db.ref('emailVerificationCodes/' + uid);
  let accepted = false;
  let failure = 'Kod hatalı veya süresi dolmuş.';
  await ref.transaction(current => {
    if (!current || current.expiresAt < Date.now()) {
      failure = 'Kodun süresi dolmuş. Yeni kod iste.';
      return;
    }
    if (current.attempts >= 5) {
      failure = 'Çok fazla yanlış deneme. Yeni kod iste.';
      return;
    }
    if (current.hash === codeHash(uid, code, CODE_PEPPER.value())) {
      accepted = true;
      return null;
    }
    current.attempts += 1;
    return current;
  });
  if (!accepted) throw new HttpsError('permission-denied', failure);
  await admin.auth().updateUser(uid, { emailVerified: true });
  return { verified: true };
});
