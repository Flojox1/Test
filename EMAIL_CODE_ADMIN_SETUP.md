# FloRod: Firebase Spark + Cloudflare Worker ile e-posta kodu doğrulama

Bu proje e-posta doğrulaması için Firebase Cloud Functions kullanmaz. Firebase Authentication kullanıcıyı oluşturur; Cloudflare Worker 6 haneli kodu gönderir ve doğrular. Böylece Firebase Spark planında kalınabilir.

## Akış
1. Kullanıcı Firebase Authentication ile e-posta/şifre hesabı oluşturur.
2. Tarayıcı Firebase ID token'ını Cloudflare Worker'a gönderir.
3. Worker ID token'ı Firebase Identity Toolkit ile doğrular.
4. Worker 6 haneli kod üretir; kodun SHA-256 özeti Cloudflare KV'de tutulur.
5. Brevo üzerinden e-posta gönderilir.
6. Kullanıcı kodu girince Worker kodu kontrol eder ve Google servis hesabı üzerinden Firebase hesabını `emailVerified: true` yapar.

## Kurulum

Ayrıntılı adımlar için `cloudflare/README.md` dosyasına bak.

1. Firebase Console > Authentication > Sign-in method > Email/Password açık olsun.
2. Cloudflare hesabında Workers Free planını ve KV namespace'i oluştur.
3. Brevo Free hesabı oluştur, gönderici e-postanı doğrula ve API key al.
4. Google Cloud Console'da servis hesabı oluştur; projeye Firebase Authentication Admin rolü (veya `firebaseauth.users.update` izni) ver. JSON anahtarını güvenli sakla.
5. Worker secret'larını `cloudflare/README.md` içindeki komutlarla tanımla.
6. `cloudflare/wrangler.toml` içindeki KV namespace ID alanını doldur.
7. `cd cloudflare && npx wrangler deploy` komutuyla Worker'ı dağıt.
8. Worker URL'sini `js/auth.js` içindeki `AUTH_WORKER_URL` değerine yaz.

## Ücretsiz limitler

- Cloudflare Workers Free: günlük 100.000 istek.
- Brevo Free: günlük 300 e-posta. Limitler ve plan koşulları değişebilir.
- Firebase Spark planı korunur; bu akışta Cloud Functions deploy edilmez.

## Önemli
- Servis hesabı JSON'u, Brevo API key'i ve CODE_PEPPER asla GitHub'a yüklenmemeli.
- Cloudflare KV'deki deneme sayacı yüksek hacimli/eşzamanlı saldırılarda atomik değildir. Büyük ölçekli üretimde D1 veya Durable Objects tabanlı sayaç kullanılmalı.
- Firebase Realtime Database güvenlik kuralları ayrıca korunmalı.
- Daha önce eklenmiş `functions/` klasörü bu yeni akışta kullanılmaz; Cloud Functions deploy etme.
