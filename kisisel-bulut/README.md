# Kişisel Bulut

Node.js, Express ve EJS ile geliştirilmiş tek kullanıcılı kişisel dosya
depolama paneli. Modern siyah tema; drag & drop yükleme, ilerleme animasyonu,
toast bildirimleri, anlık dosya arama, indirme ve silme özelliklerini içerir.

> Bu uygulama dosyaları sunucunun diskinde tutar. Tek kopyayı gerçek yedek kabul
> etmeyin; önemli dosyaların bağımsız ikinci bir kopyasını saklayın.

## Teknoloji ve güvenlik

- Express, EJS, Multer, Express Session, bcrypt, dotenv
- Helmet güvenlik başlıkları ve sıkı Content Security Policy
- IP başına 15 dakikada en fazla 5 başarısız giriş denemesi
- 8 saatlik `HttpOnly`, `SameSite=Strict`, üretimde `Secure` oturum çerezi
- Giriş sonrası oturum kimliği yenileme ve dosya tabanlı session store
- Bütün POST işlemlerinde CSRF doğrulaması
- UUID tabanlı fiziksel dosya adları ve güvenli görünen dosya adları
- Dizin dışına çıkma ve sembolik bağlantı koruması
- Varsayılan 2 GB tek dosya sınırı ve büyük dosya hata yönetimi
- Yerel Font Awesome paketi; harici CDN bağımlılığı yoktur

## Klasör yapısı

```text
project/
├── app.js
├── package.json
├── package-lock.json
├── .env.example
├── .gitignore
├── README.md
├── render.yaml
├── uploads/
├── routes/
│   └── health.js
├── scripts/
│   └── hash-password.js
├── public/
│   ├── css/style.css
│   ├── js/dashboard.js
│   └── img/
└── views/
    ├── login.ejs
    ├── dashboard.ejs
    ├── error.ejs
    ├── layout.ejs
    └── partials/
```

`uploads/` web üzerinden statik olarak yayınlanmaz. Dosyalara yalnızca oturum
kontrolünden geçen indirme rotası erişebilir.

## Lokal kurulum

Gereksinim: Node.js 20 veya daha yeni.

```bash
npm install
```

Örnek ortam dosyasını kopyalayın:

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

```bash
# macOS / Linux
cp .env.example .env
```

En az 12 karakterlik parolanız için bcrypt özeti üretin:

```bash
npm run hash-password -- "Cok-Guclu-Bir-Sifre"
```

Çıktıyı `.env` içindeki `ADMIN_PASSWORD_HASH` değerine yazın. Parolanın
kendisini `.env` içine koymayın.

Session secret üretin:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Çıktıyı `.env` içindeki `SESSION_SECRET` değerine yazın ve başlatın:

```bash
npm start
```

Uygulama `http://localhost:3000` adresinde açılır. Varsayılan kullanıcı adı
`admin`, parola ise özetini ürettiğiniz paroladır.

## Environment Variables

| Değişken | Zorunlu | Açıklama |
| --- | --- | --- |
| `ADMIN_USERNAME` | Hayır | Kullanıcı adı; varsayılan `admin` |
| `ADMIN_PASSWORD_HASH` | Evet | Parolanın bcrypt özeti |
| `SESSION_SECRET` | Evet | En az 32 karakterlik rastgele anahtar |
| `PORT` | Hayır | Port; varsayılan `3000` |
| `NODE_ENV` | Hayır | Hosting üzerinde `production` |
| `MAX_FILE_SIZE_MB` | Hayır | Tek dosya sınırı; varsayılan `2048` |
| `TZ` | Hayır | Saat dilimi; varsayılan `Europe/Istanbul` |
| `UPLOAD_DIR` | Hayır | Yükleme klasörü; varsayılan `./uploads` |
| `SESSION_DIR` | Hayır | Session klasörü; varsayılan `./storage/sessions` |

Kullanıcı adını değiştirmek için `ADMIN_USERNAME`, parolayı değiştirmek için
yeni bcrypt özeti üreterek `ADMIN_PASSWORD_HASH` değerini güncelleyin.

## GitHub'a yükleme

Dosyaları tercihen **private** bir repoya gönderin:

```bash
git init
git add .
git commit -m "Kişisel bulut ilk sürüm"
git branch -M main
git remote add origin https://github.com/KULLANICI/REPO.git
git push -u origin main
```

`.env`, yüklenen dosyalar, session dosyaları ve `node_modules` zaten
`.gitignore` kapsamındadır. `.env` dosyasını veya gerçek secret değerlerini
GitHub'a kesinlikle göndermeyin.

## Render'a tek tık yükleme

Repo kökündeki `render.yaml`, Render Blueprint dağıtımına hazırdır:

1. Projeyi GitHub'a gönderin.
2. [Render Dashboard](https://dashboard.render.com/) içinde **New → Blueprint**
   seçin ve repoyu bağlayın.
3. Render, `render.yaml` dosyasını okuyarak build komutunu `npm ci`, start
   komutunu `npm start` ve health check yolunu `/healthz` olarak ayarlar.
4. İstendiğinde `ADMIN_PASSWORD_HASH` değerini girin.
5. `SESSION_SECRET` Blueprint tarafından güvenli şekilde otomatik üretilir.
6. Deploy bitince verilen HTTPS `onrender.com` adresini açın.

Manuel Web Service kurulumunda:

```text
Build Command: npm ci
Start Command: npm start
```

Environment bölümüne en az şunları ekleyin:

```text
NODE_ENV=production
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=<bcrypt özeti>
SESSION_SECRET=<uzun rastgele değer>
MAX_FILE_SIZE_MB=2048
```

Render, HTTPS'i uç noktada sonlandırır; uygulamadaki `trust proxy` ve güvenli
çerez ayarları buna hazırdır. Ayrıntılar için
[Render Express rehberi](https://render.com/docs/deploy-node-express-app)
incelenebilir.

### Render kalıcılık uyarısı

Render Free Web Service dosya sistemi geçicidir. Servis uyuduğunda, yeniden
başladığında veya yeniden deploy edildiğinde yüklemeler silinebilir. Ücretsiz
dağıtım uygulamayı denemek içindir. Kalıcı kullanım için ücretli servise
`/opt/render/project/src/uploads` yolunda persistent disk bağlayın ve
`UPLOAD_DIR=/opt/render/project/src/uploads` ayarlayın.

Güncel bilgiler:
[Render Free](https://render.com/docs/free) ve
[Render Persistent Disks](https://render.com/docs/disks).

## Railway alternatifi

Railway üzerinde servise `/data` yolunda Volume bağlayıp şu değerleri kullanın:

```text
UPLOAD_DIR=/data/uploads
SESSION_DIR=/data/sessions
```

Güncel ücretsiz plan ve volume limitleri için
[Railway planları](https://docs.railway.com/pricing/plans) ile
[Railway Volumes](https://docs.railway.com/volumes/reference) sayfalarını
kontrol edin.

## 2 GB dosya notu

Uygulama katmanındaki varsayılan sınır 2 GB'dır. Hosting sağlayıcısının istek
süresi, disk kapasitesi, proxy body limiti veya ücretsiz plan kotası daha düşük
olabilir. Özellikle ücretsiz Render servisi 2 GB kalıcı depolama garantisi
vermez.

## Komutlar

```bash
npm start
npm run dev
npm run hash-password -- "en-az-12-karakter"
npm run check
```

## İşletim notları

- İnternette yalnızca HTTPS kullanın.
- Repo private olsa dahi `.env` ve secret değerlerini commit etmeyin.
- Uygulama tek kullanıcı ve tek instance için tasarlanmıştır.
- Virüs taraması ve istemci tarafı şifreleme yapmaz.
- Düzenli olarak bağımsız ikinci yedek alın.
