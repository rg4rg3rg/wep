const RESEND_KEY_SALT = "ORBIT-RESEND-2026";
const RESEND_KEY_PAYLOAD = "PTcdGhxlNSYfMQwbZV97R30XMzEZGEMFFzkrCh1ldXwGeAo9";
const FROM_EMAIL = "ORBIT <onboarding@resend.dev>";
const SUPPORT_EMAIL = "orbit.platform.tr@gmail.com";

function decodeSecret(payload, saltText) {
  const encrypted = Buffer.from(payload, "base64");
  const salt = Buffer.from(saltText, "utf8");
  return Buffer.from(encrypted.map((byte, index) => byte ^ salt[index % salt.length])).toString("utf8");
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
    return { statusCode: 405, body: JSON.stringify({ message: "Sadece POST desteklenir." }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const email = String(body.email || "").trim().toLowerCase();
    const code = String(body.code || "").trim();
    const purpose = String(body.purpose || "register");

    if (!email.includes("@") || !code.match(/^\d{6}$/)) {
      return { statusCode: 400, body: JSON.stringify({ message: "E-posta veya kod hatalı." }) };
    }

    const apiKey = process.env.RESEND_API_KEY || decodeSecret(RESEND_KEY_PAYLOAD, RESEND_KEY_SALT);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.ORBIT_FROM_EMAIL || FROM_EMAIL,
        to: email,
        subject: `ORBIT doğrulama kodun: ${code}`,
        html: htmlTemplate(code, purpose),
        text: `ORBIT doğrulama kodun: ${code}. Bu kod 5 dakika geçerlidir.`,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { statusCode: 500, body: JSON.stringify({ message: data.message || "Mail gönderilemedi." }) };
    }

    return { statusCode: 200, body: JSON.stringify({ sent: true, id: data.id || null }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ message: error.message || "Sunucu hatası." }) };
  }
};
