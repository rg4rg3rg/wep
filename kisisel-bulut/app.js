"use strict";

require("dotenv").config();

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const bcrypt = require("bcryptjs");
const express = require("express");
const expressLayouts = require("express-ejs-layouts");
const session = require("express-session");
const FileStoreFactory = require("session-file-store");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const multer = require("multer");
const healthRouter = require("./routes/health");

const app = express();
const FileStore = FileStoreFactory(session);

const PORT = positiveInteger(process.env.PORT, 3000);
const MAX_FILE_SIZE_MB = positiveInteger(process.env.MAX_FILE_SIZE_MB, 2048);
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const SESSION_SECRET = process.env.SESSION_SECRET;
const isProduction = process.env.NODE_ENV === "production";

if (!ADMIN_PASSWORD_HASH || !SESSION_SECRET) {
  console.error(
    "Eksik ortam değişkeni: ADMIN_PASSWORD_HASH ve SESSION_SECRET tanımlanmalıdır."
  );
  process.exit(1);
}

if (SESSION_SECRET.length < 32) {
  console.error("SESSION_SECRET en az 32 karakter olmalıdır.");
  process.exit(1);
}

const uploadDirectory = path.resolve(
  process.env.UPLOAD_DIR || path.join(__dirname, "uploads")
);
const sessionDirectory = path.resolve(
  process.env.SESSION_DIR || path.join(__dirname, "storage", "sessions")
);

fs.mkdirSync(uploadDirectory, { recursive: true });
fs.mkdirSync(sessionDirectory, { recursive: true });

if (isProduction) {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layout");

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "default-src": ["'self'"],
        "style-src": ["'self'"],
        "script-src": ["'self'"],
        "img-src": ["'self'", "data:"],
        "form-action": ["'self'"],
        "frame-ancestors": ["'none'"]
      }
    },
    crossOriginResourcePolicy: { policy: "same-origin" }
  })
);
app.use(express.urlencoded({ extended: false, limit: "16kb" }));
app.use(
  express.static(path.join(__dirname, "public"), {
    etag: true,
    maxAge: isProduction ? "1d" : 0,
    index: false
  })
);
app.use(
  "/vendor/fontawesome",
  express.static(path.join(__dirname, "node_modules", "@fortawesome", "fontawesome-free"), {
    etag: true,
    maxAge: isProduction ? "7d" : 0,
    index: false
  })
);
app.use(
  session({
    name: "yedek.sid",
    store: new FileStore({
      path: sessionDirectory,
      ttl: 60 * 60 * 8,
      retries: 1,
      logFn: () => {}
    }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (request, response) => {
    response.status(429).render("login", {
      title: "Giriş",
      pageClass: "auth-page",
      script: null,
      csrfToken: getCsrfToken(request),
      error: "Çok fazla giriş denemesi yapıldı. Lütfen 15 dakika sonra tekrar deneyin."
    });
  }
});

const upload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => callback(null, uploadDirectory),
    filename: (_request, file, callback) => {
      const safeName = sanitizeFilename(file.originalname);
      callback(null, `${crypto.randomUUID()}--${safeName}`);
    }
  }),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
    fields: 2
  }
});

app.get("/", (request, response) => {
  response.redirect(request.session.authenticated ? "/dashboard" : "/login");
});

app.use("/healthz", healthRouter);

app.get("/login", redirectIfAuthenticated, (request, response) => {
  response.set("Cache-Control", "no-store");
  response.render("login", {
    title: "Giriş",
    pageClass: "auth-page",
    script: null,
    csrfToken: getCsrfToken(request),
    error: null
  });
});

app.post("/login", loginLimiter, verifyCsrf, redirectIfAuthenticated, (request, response, next) => {
  const username = String(request.body.username || "");
  const password = String(request.body.password || "");
  const usernameMatches = constantTimeTextEqual(username, ADMIN_USERNAME);
  const passwordMatches = bcrypt.compareSync(password, ADMIN_PASSWORD_HASH);

  if (!usernameMatches || !passwordMatches) {
    response.status(401).render("login", {
      title: "Giriş",
      pageClass: "auth-page",
      script: null,
      csrfToken: getCsrfToken(request),
      error: "Kullanıcı adı veya şifre hatalı."
    });
    return;
  }

  request.session.regenerate((error) => {
    if (error) return next(error);
    request.session.authenticated = true;
    request.session.username = ADMIN_USERNAME;
    getCsrfToken(request);
    request.session.save((saveError) => {
      if (saveError) return next(saveError);
      response.redirect("/dashboard");
    });
  });
});

app.get("/panel", requireAuthentication, (_request, response) => {
  response.redirect("/dashboard");
});

app.get("/dashboard", requireAuthentication, async (request, response, next) => {
  try {
    response.set("Cache-Control", "no-store");
    const files = await listUploadedFiles();
    response.render("dashboard", {
      title: "Dosyalarım",
      pageClass: "dashboard-page",
      script: "/js/dashboard.js",
      username: request.session.username,
      files,
      csrfToken: getCsrfToken(request),
      message: flash(request, "message"),
      error: flash(request, "error"),
      maxFileSizeMb: MAX_FILE_SIZE_MB,
      formatBytes,
      formatDate
    });
  } catch (error) {
    next(error);
  }
});

app.post(
  "/upload",
  requireAuthentication,
  (request, response, next) => {
    upload.single("file")(request, response, (error) => {
      if (error) return next(error);
      verifyCsrf(request, response, (csrfError) => {
        if (csrfError) return next(csrfError);
        if (!request.file) {
          request.session.error = "Yüklenecek bir dosya seçin.";
        } else {
          request.session.message = `"${displayName(request.file.filename)}" yüklendi.`;
        }
        if (request.get("x-requested-with") === "XMLHttpRequest") {
          response.status(201).json({ ok: true });
        } else {
          response.redirect("/dashboard");
        }
      });
    });
  }
);

app.get("/files/:id/download", requireAuthentication, async (request, response, next) => {
  try {
    const filePath = await resolveStoredFile(request.params.id);
    response.set("Cache-Control", "private, no-store");
    response.download(filePath, displayName(request.params.id), (error) => {
      if (error && !response.headersSent) next(error);
    });
  } catch (error) {
    next(error);
  }
});

app.post("/files/:id/delete", requireAuthentication, verifyCsrf, async (request, response, next) => {
  try {
    const filePath = await resolveStoredFile(request.params.id);
    const name = displayName(request.params.id);
    await fs.promises.unlink(filePath);
    request.session.message = `"${name}" silindi.`;
    response.redirect("/dashboard");
  } catch (error) {
    next(error);
  }
});

app.post("/logout", requireAuthentication, verifyCsrf, (request, response, next) => {
  request.session.destroy((error) => {
    if (error) return next(error);
    response.clearCookie("yedek.sid", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict"
    });
    response.redirect("/login");
  });
});

app.use((request, response) => {
  response.status(404).render("error", {
    pageClass: "auth-page",
    script: null,
    title: "Sayfa bulunamadı",
    message: "Aradığınız sayfa bulunamadı."
  });
});

app.use((error, request, response, _next) => {
  console.error(error);

  if (request.file?.path) {
    fs.promises.unlink(request.file.path).catch(() => {});
  }

  let status = error.status || error.statusCode || 500;
  let message = "Beklenmeyen bir hata oluştu.";

  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    status = 413;
    message = `Dosya çok büyük. En fazla ${MAX_FILE_SIZE_MB} MB yükleyebilirsiniz.`;
  } else if (error instanceof multer.MulterError) {
    status = 400;
    message = "Dosya yüklenemedi. Lütfen dosyayı kontrol edip tekrar deneyin.";
  } else if (error.code === "ENOENT" || error.code === "INVALID_FILE") {
    status = 404;
    message = "Dosya bulunamadı.";
  } else if (error.code === "EBADCSRFTOKEN") {
    status = 403;
    message = "Formun süresi doldu. Sayfayı yenileyip tekrar deneyin.";
  }

  if (request.get("x-requested-with") === "XMLHttpRequest" && !response.headersSent) {
    response.status(status).json({ ok: false, message });
    return;
  }

  if (request.session?.authenticated && !response.headersSent) {
    request.session.error = message;
    response.redirect("/dashboard");
    return;
  }

  if (!response.headersSent) {
    response.status(status).render("error", {
      title: "Hata",
      pageClass: "auth-page",
      script: null,
      message
    });
  }
});

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function sanitizeFilename(originalName) {
  const base = path
    .basename(String(originalName || "dosya"))
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, "_")
    .replace(/^\.+/, "")
    .replace(/[ .]+$/g, "");
  return truncateUtf8(base || "dosya", 180);
}

function truncateUtf8(value, maxBytes) {
  let result = "";
  for (const character of value) {
    if (Buffer.byteLength(result + character, "utf8") > maxBytes) break;
    result += character;
  }
  return result || "dosya";
}

function isValidStoredId(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}--[^/\\]+$/i.test(
    id
  );
}

async function resolveStoredFile(id) {
  if (!isValidStoredId(id)) {
    const error = new Error("Geçersiz dosya");
    error.code = "INVALID_FILE";
    throw error;
  }

  const candidate = path.resolve(uploadDirectory, id);
  if (path.dirname(candidate) !== uploadDirectory) {
    const error = new Error("Geçersiz dosya yolu");
    error.code = "INVALID_FILE";
    throw error;
  }

  const stats = await fs.promises.lstat(candidate);
  if (!stats.isFile() || stats.isSymbolicLink()) {
    const error = new Error("Geçersiz dosya");
    error.code = "INVALID_FILE";
    throw error;
  }
  return candidate;
}

async function listUploadedFiles() {
  const entries = await fs.promises.readdir(uploadDirectory, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && isValidStoredId(entry.name))
      .map(async (entry) => {
        const filePath = path.resolve(uploadDirectory, entry.name);
        const stats = await fs.promises.lstat(filePath);
        if (!stats.isFile() || stats.isSymbolicLink()) return null;
        return {
          id: entry.name,
          name: displayName(entry.name),
          size: stats.size,
          modifiedAt: stats.mtime
        };
      })
  );
  return files
    .filter(Boolean)
    .sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
}

function displayName(storedName) {
  return storedName.slice(storedName.indexOf("--") + 2);
}

function requireAuthentication(request, response, next) {
  if (!request.session.authenticated) {
    response.redirect("/login");
    return;
  }
  next();
}

function redirectIfAuthenticated(request, response, next) {
  if (request.session.authenticated) {
    response.redirect("/dashboard");
    return;
  }
  next();
}

function getCsrfToken(request) {
  if (!request.session.csrfToken) {
    request.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }
  return request.session.csrfToken;
}

function verifyCsrf(request, _response, next) {
  const expected = request.session.csrfToken || "";
  const received = String(request.body._csrf || request.get("x-csrf-token") || "");
  if (!constantTimeTextEqual(received, expected) || !expected) {
    const error = new Error("Geçersiz CSRF belirteci");
    error.code = "EBADCSRFTOKEN";
    next(error);
    return;
  }
  next();
}

function constantTimeTextEqual(left, right) {
  const leftHash = crypto.createHash("sha256").update(String(left)).digest();
  const rightHash = crypto.createHash("sha256").update(String(right)).digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}

function flash(request, key) {
  const value = request.session[key] || null;
  delete request.session[key];
  return value;
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unit;
  return `${value.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} ${units[unit]}`;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: process.env.TZ || "Europe/Istanbul"
  }).format(date);
}

app.listen(PORT, () => {
  console.log(`Kişisel yedekleme paneli http://localhost:${PORT} adresinde çalışıyor.`);
});
