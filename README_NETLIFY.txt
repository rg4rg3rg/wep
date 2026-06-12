ORBIT Netlify Paketi

Kurulum:
1. Netlify hesabina gir.
2. Add new site > Deploy manually alanina bu zip dosyasini surukle.
3. Ana dosya index.html olarak hazirdir.

Bu paket Netlify icin hazirdir:
- PHP yok.
- MySQL yok.
- server.py, start.bat ve orbit_data.db yok.
- Kullanici, profil, gonderi, foto ve video verileri Netlify Blobs veritabaninda saklanir.
- Tarayici localStorage alani yedek/onbellek olarak kullanilir.

Calisan ozellikler:
- Mobil ve PC uyumlu arayuz.
- Kayit/giris demo akisi.
- OTP kodu Netlify Functions uzerinden mail API ile gonderilir.
- Kullanicilar ve gonderiler Netlify Functions + Netlify Blobs ile ortak veritabanina kaydedilir.
- Profil fotografi galeriden veya kameradan secilir.
- Gonderiye fotograf/video galeriden secilir.
- Paylasimlar ve profiller ayni tarayicida kayitli kalir.

Not:
- Mail icin send-code.js dosyasi kullanilir. En temiz kurulum icin Netlify Environment Variables alanina RESEND_API_KEY eklenebilir.
- Veritabani icin database.js dosyasi ve @netlify/blobs paketi kullanilir.
- GitHub'a yuklerken send-code.js ve database.js ana dizinde durabilir; netlify.toml functions yolunu ana dizin olarak ayarlar.
