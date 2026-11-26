# FloRod: kodla e-posta doğrulama ve admin kurulumu

## E-posta kodu
Kayıt sonrası Firebase Authentication hesabı açılır; Cloud Function kullanıcıya 6 haneli kod yollar. Kod 5 dakika geçerlidir, 60 saniyede bir yeniden gönderilebilir ve en fazla 5 yanlış deneme kabul edilir. Kodun kendisi veritabanında tutulmaz; HMAC özeti saklanır.

## Firebase / Cloud Functions kurulumu
1. Firebase projesinde **Blaze** planını etkinleştir (Cloud Functions dağıtımı için faturalandırma gerekir).
2. Firebase Console > Authentication > Sign-in method > Email/Password açık olsun.
3. Bilgisayarda `npm install -g firebase-tools`, ardından `firebase login` çalıştır.
4. Depoyu klonla; proje kökünde `firebase use chat-f3082` çalıştır.
5. `cd functions && npm install && cd ..`
6. SMTP sağlayıcından uygulama şifresi/API SMTP bilgilerini al. Gmail kullanıyorsan normal Gmail şifreni değil, 2 adımlı doğrulama sonrası uygulama şifresini kullan.
7. Proje kökünde şu secret'ları tanımla: `firebase functions:secrets:set SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `CODE_PEPPER` (her biri için komutu ayrı çalıştır; istenince değeri gir).
8. `firebase deploy --only functions`

## Admin hesabı
Admin hesabı tarayıcıya sabit şifre gömülerek oluşturulmaz. Firebase servis hesabı kimlik bilgilerini güvenli biçimde yerel bilgisayarına indir; JSON dosyasını GitHub'a yükleme. `GOOGLE_APPLICATION_CREDENTIALS`, `ADMIN_EMAIL` ve güçlü `ADMIN_PASSWORD` ortam değişkenlerini ayarlayıp `cd functions && node set-admin.js` çalıştır. Script kullanıcıya `role: admin` custom claim verir. Admin girişi Firebase Authentication e-posta/şifre hesabıyla yapılır; görünen adı admin olur. İstenen admin123 şifresi repoya yazılmadı; çok kolay tahmin edilir ve güvenli değildir.

## Notlar
- Cloud Functions endpoint'i `europe-west1` bölgesindedir.
- Realtime Database güvenlik kurallarını ayrıca yapılandır; Admin SDK kuralları atlar.
- Bu dosyalar kod altyapısını ekler; SMTP secret'ları girilip fonksiyonlar deploy edilmeden e-posta gönderimi çalışmaz.
