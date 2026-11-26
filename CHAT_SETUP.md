# FloRod sohbet kurulumu

Sohbet arayüzü ve Firebase istemcisi projede hazırdır. Bu adımları bir kez tamamla.

## 1. Firebase projesi oluştur
1. [Firebase Console](https://console.firebase.google.com/) adresini aç ve yeni proje oluştur.
2. Projeye Web uygulaması ekle (</> simgesi).
3. Firebase'in verdiği web yapılandırmasındaki apiKey, authDomain, databaseURL, projectId, storageBucket, messagingSenderId ve appId değerlerini hazır tut.

## 2. Realtime Database oluştur
1. Firebase Console → Build → Realtime Database → Create Database.
2. Veritabanını oluştur.
3. Veritabanı URL'sini kopyala. Örnek biçim: https://proje-adi-default-rtdb.firebaseio.com (bölgeye göre farklı olabilir).

## 3. Anonim girişi etkinleştir
Firebase Console → Build → Authentication → Get started → Sign-in method → Anonymous → Enable → Save.
Kod, mesaj göndermeden önce Firebase Anonymous Authentication ile oturum açar.

## 4. Realtime Database güvenlik kuralları
Realtime Database → Rules bölümüne aşağıdaki kuralları yapıştırıp Publish'e bas:

```json
{
  "rules": {
    "chat": {
      ".read": "auth != null && auth.token.email_verified == true",
      "$messageId": {
        ".write": "auth != null && auth.token.email_verified == true && !data.exists()",
        ".validate": "newData.hasChildren(['name', 'text', 'ts']) && newData.child('name').isString() && newData.child('name').val().length > 0 && newData.child('name').val().length <= 20 && newData.child('text').isString() && newData.child('text').val().length > 0 && newData.child('text').val().length <= 200 && newData.child('ts').isNumber()"
      }
    }
  }
}
```

Bu kurallar yalnızca oturum açmış kullanıcıların sohbeti okumasına ve yeni mesaj eklemesine izin verir; mevcut mesajları değiştirmeyi engeller. Herkese açık test kurallarını (read/write true) kullanma.

## 5. Web yapılandırmasını GitHub'a ekle
GitHub'da js/config.js dosyasını aç. Firebase Console'daki web config değerlerini aynı isimli alanlara yapıştır. databaseURL alanı Realtime Database URL'si olmalı. Commit changes ile kaydet.

## 6. Test et
Siteyi yenile. Sohbet panelinde durum "Bağlı" görünmeli. İki farklı tarayıcı/cihazdan açıp farklı adlarla mesaj göndererek gerçek zamanlı çalıştığını test et.

## Güvenlik notları
- Firebase Web API anahtarı istemci tarafında bulunur; tek başına veritabanı erişim izni vermez. Güvenliği Authentication ve Realtime Database Rules sağlar.
- Anonim giriş spam'i tek başına engellemez. Herkese açık yayında Firebase App Check, hız sınırı ve moderasyon ekle.
- Sohbet istemcisi Firebase SDK'sını CDN üzerinden yükler; npm kurulumu gerekmez.
