# Kişisel Bulut — Düz Klasör Sürümü

Bu sürümde GitHub'a yüklenecek bütün proje dosyaları tek klasörün kökündedir.
Kaynak klasörün içinde alt klasör veya ZIP bulunmaz.

## Dosyalar

```text
.env.example
.gitignore
app.js
dashboard.ejs
dashboard.js
error.ejs
hash-password.js
layout.ejs
login.ejs
package-lock.json
package.json
README.md
render.yaml
style.css
```

Uygulama çalışırken yüklemeleri ve session dosyalarını işletim sisteminin geçici
alanında saklar; proje klasörünün içinde upload/session klasörü oluşturmaz.
Render Free üzerindeki bu geçici dosyalar yeniden başlatmada kaybolabilir.

## Kurulum

```bash
npm install
```

`.env.example` dosyasını `.env` adıyla kopyalayın.

Parola özeti üretin:

```bash
npm run hash-password -- "en-az-12-karakterlik-sifre"
```

Session secret üretin:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Değerleri `.env` içine yazdıktan sonra:

```bash
npm start
```

Adres: `http://localhost:3000`

## Render

```text
Build Command: npm ci
Start Command: npm start
Entry File: app.js
```

Environment Variables:

```text
NODE_ENV=production
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=<bcrypt özeti>
SESSION_SECRET=<en az 32 karakterlik rastgele değer>
MAX_FILE_SIZE_MB=2048
TZ=Europe/Istanbul
```

`PORT` eklemeyin; Render otomatik sağlar. Repo kökündeki `render.yaml` dosyası
Blueprint dağıtımına hazırdır.

## GitHub

Klasörü açıp içindeki bütün dosyaları GitHub repo sayfasına birlikte
sürükleyebilirsiniz. `.env` dosyasını yüklemeyin.
