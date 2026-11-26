# FloRod Cloudflare Worker e-posta doğrulama

Bu Worker, Firebase Spark projesiyle çalışır; Firebase Cloud Functions deploy edilmez. 6 haneli kodu Cloudflare KV'de saklar, Brevo API ile e-posta gönderir ve kod doğruysa Firebase Authentication hesabını yönetici REST API'si üzerinden `emailVerified: true` yapar.

## Ücretsiz servisler

- Cloudflare Workers Free: günlük 100.000 istek sınırı.
- Brevo Free: günlük 300 e-posta sınırı. Brevo hesabında gönderici adresini doğrulaman gerekir. Ücretsiz planda e-postalarda Brevo markası bulunabilir.

## 1. Cloudflare KV

1. Cloudflare Dashboard > Workers & Pages > KV bölümünde bir namespace oluştur: `EMAIL_CODES`.
2. Namespace ID'yi `wrangler.toml` içindeki `REPLACE_WITH_KV_NAMESPACE_ID` alanına yaz.

## 2. Worker secrets

`cloudflare` klasöründe terminal aç ve aşağıdaki komutları çalıştır. Komutlar değerleri gizli olarak ister:

```bash
npx wrangler secret put FIREBASE_API_KEY
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT
npx wrangler secret put BREVO_API_KEY
npx wrangler secret put BREVO_SENDER_EMAIL
npx wrangler secret put CODE_PEPPER
```

- `FIREBASE_API_KEY`: Firebase web API key (js/config.js içindeki apiKey).
- `FIREBASE_SERVICE_ACCOUNT`: Firebase projesine erişimi olan Google servis hesabı JSON dosyasının tamamı. JSON'u repoya/GitHub'a koyma. Servis hesabına `Firebase Authentication Admin` veya `firebaseauth.users.update` yetkisi ver.
- `BREVO_API_KEY`: Brevo SMTP/API key.
- `BREVO_SENDER_EMAIL`: Brevo'da doğrulanmış gönderici e-posta adresi.
- `CODE_PEPPER`: Uzun ve rastgele bir gizli değer.

## 3. Worker deploy

```bash
npx wrangler deploy
```

Deploy sonunda `https://florod-auth.<hesap-adin>.workers.dev` benzeri adres verilir. Bu adresi `js/auth.js` içindeki `AUTH_WORKER_URL` değerine yazıp GitHub'a gönder.

## 4. Brevo

Brevo Free hesabı aç, gönderen e-posta adresini doğrula ve API key oluştur. Ücretsiz hesap günlük 300 e-posta gönderimiyle sınırlıdır.

## Güvenlik

- Servis hesabı JSON'unu, Brevo API key'ini veya CODE_PEPPER değerini asla GitHub'a yükleme.
- Worker kodu 5 dakikalık kod süresi ve 60 saniyelik yeniden gönderim beklemesi uygular.
- Kod denemeleri beş ile sınırlandırılmıştır. KV'nin eşzamanlı isteklerde atomik sayaç sağlamadığı unutulmamalı; yüksek hacimli üretim için D1 veya Durable Objects tabanlı sayaç tercih edilir.
- Firebase Realtime Database güvenlik kurallarını ayrıca yapılandır.
