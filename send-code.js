const nodemailer = require("nodemailer");

const EMAIL_USER = "orbit.platform.tr@gmail.com";
const SUPPORT_EMAIL = EMAIL_USER;
const MAIL_KEY_SALT = "ORBIT-GMAIL-2026";
const MAIL_KEY_PAYLOAD = "ICE7MHRIMDogaTlUQUoSTDYrLQ==";

function decodeSecret(payload, saltText) {
  const encrypted = Buffer.from(payload, "base64");
  const salt = Buffer.from(saltText, "utf8");
  return Buffer.from(encrypted.map((byte, index) => byte ^ salt[index % salt.length])).toString("utf8");
}

function gmailPassword() {
  return (process.env.EMAIL_PASS || decodeSecret(MAIL_KEY_PAYLOAD, MAIL_KEY_SALT)).replace(/\s+/g, "");
}

function htmlTemplate(code, purpose) {
  const title = purpose === "reset" ? "Şifre sıfırlama" : "Hesap doğrulama";
  return `<!doctype html>
<html><body style="margin:0;background:#070814;font-family:Segoe UI,Arial,sans-serif;color:#f4f7ff">
<table width="100%" cellspacing="0" cellpadding="0" style="background:#070814;padding:30px 12px"><tr><td align="center">
<table width="100%" cellspacing="0" cellpadding="0" style="max-width:590px;background:#111326;border:1px solid rgba(255,255,255,.14);border-radius:24px;overflow:hidden">
<tr><td style="padding:30px;background:linear-gradient(135deg,#7c5cff,#00e5ff);color:white">
<div style="font-size:13px;font-weight:900;letter-spacing:2px">ORBIT SOCIAL UNIVERSE</div>
<div style="font-size:32px;font-weight:900;margin-top:8px">${title}</div>
</td></tr>
<tr><td style="padding:30px">
<div style="font-size:16px;line-height:1.7;color:#dfe6ff">Merhaba, ORBIT hesabını korumak için aşağıdaki tek kullanımlık kodu gir.</div>
<div style="margin:26px 0;padding:22px;background:#070814;border:1px solid rgba(255,255,255,.14);border-radius:22px;text-align:center">
<div style="font-size:12px;color:#9aa4c7;font-weight:900;letter-spacing:1px">6 HANELİ OTP KODU</div>
<div style="font-size:44px;color:#00e5ff;font-weight:950;letter-spacing:8px;margin-top:10px">${code}</div>
</div>
<div style="font-size:14px;line-height:1.7;color:#9aa4c7">Bu kod 5 dakika geçerlidir. Kodu kimseyle paylaşma.</div>
</td></tr>
<tr><td style="padding:20px 30px;background:#0b0d1b;color:#9aa4c7;font-size:12px">Destek: ${SUPPORT_EMAIL}</td></tr>
</table></td></tr></table></body></html>`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ message: "Sadece POST desteklenir." }),
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const email = String(body.email || "").trim().toLowerCase();
    const code = String(body.code || "").trim();
    const purpose = String(body.purpose || "register");

    if (!email.includes("@") || !code.match(/^\d{6}$/)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ message: "E-posta veya kod hatalı." }),
      };
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: EMAIL_USER,
        pass: gmailPassword(),
      },
    });

    await transporter.sendMail({
      from: `"ORBIT" <${EMAIL_USER}>`,
      to: email,
      subject: `ORBIT doğrulama kodun: ${code}`,
      html: htmlTemplate(code, purpose),
      text: `ORBIT doğrulama kodun: ${code}. Bu kod 5 dakika geçerlidir.`,
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ sent: true, message: "Kod mail adresine gönderildi." }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ message: error.message || "Mail gönderilemedi." }),
    };
  }
};
