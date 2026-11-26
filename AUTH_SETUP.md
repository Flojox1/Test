# FloRod hesap ve Gmail doğrulama kurulumu

Oyuncular Gmail adresleriyle (veya başka bir e-posta adresiyle) e-posta/şifre hesabı açabilir. Firebase doğrulama e-postasını gönderir; doğrulama tamamlanmadan oyun açılmaz.

## Firebase kurulumu

1. https://console.firebase.google.com/ adresinde FloRod Firebase projesini aç.
2. Authentication → Get started → Sign-in method bölümüne gir.
3. **Email/Password** sağlayıcısını etkinleştir. E-posta/şifre seçeneğini aç; Email link (passwordless) gerekli değil.
4. Authentication → Settings → Authorized domains bölümünde oyunun yayınlandığı alan adının bulunduğunu kontrol et. GitHub Pages kullanıyorsan yayınlanan `*.github.io` alan adını ekle.
5. Authentication → Templates → Email address verification bölümünden doğrulama e-postasının konu ve metnini düzenleyebilirsin. Gönderen adı ve dil ayarlarını da kontrol et.
6. Project settings → General → Your apps bölümündeki Web App config değerlerini `js/config.js` içine yerleştir. Realtime Database kullanıyorsan databaseURL değerini de doğru gir.
7. Kaydet ve siteyi yenile.

## Oyuncu akışı

- Kayıt ekranında e-posta ve en az 6 karakterli şifre girilir.
- Firebase kullanıcı hesabını oluşturur ve doğrulama e-postası yollar.
- Oyuncu gelen e-postadaki bağlantıya tıklar.
- Giriş ekranından e-posta/şifre ile giriş yapınca uygulama doğrulamayı kontrol eder.
- Doğrulanmamış hesap oyun sayfasına alınmaz.

## Test

1. Gerçek erişebildiğin bir Gmail adresiyle kayıt ol.
2. Gelen kutusu ve Spam klasörünü kontrol et.
3. Doğrulama bağlantısına tıkla.
4. Giriş ekranından tekrar giriş yap.
5. Doğrulamadan önce girişin engellendiğini ayrıca test et.

## Önemli

- Gmail adresiyle kayıt olmak için Google ile giriş (OAuth) şart değil. Bu uygulama e-posta/şifre kullanır ve Firebase doğrulama e-postası gönderir.
- Firebase Console'da Email/Password sağlayıcısı açık değilse kayıt çalışmaz.
- Firebase Web API anahtarı istemci uygulamasında bulunur; veritabanı güvenliğini Authentication ve Realtime Database Rules ile koru.
- Şu anki oyun ilerlemesi mevcut tarayıcıdaki localStorage kayıt mekanizmasını kullanır. Hesapla giriş sistemi tek başına ilerlemeyi cihazlar arasında eşitlemez; bunun için ayrıca kullanıcı UID'sine bağlı bulut kayıt sistemi gerekir.
- Firebase e-posta gönderim kotası ve doğrulama bağlantısı ayarları Firebase projenin planına/şablonlarına bağlıdır.
