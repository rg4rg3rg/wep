<?php
declare(strict_types=1);

session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/config.php';

const EMAIL_USER = 'orbit.platform.tr@gmail.com';
const SUPPORT_EMAIL = EMAIL_USER;
const MAIL_KEY_SALT = 'ORBIT-GMAIL-2026';
const MAIL_KEY_PAYLOAD = 'ICE7MHRIMDogaTlUQUoSTDYrLQ==';
const ADMIN_KEY_SALT = 'ORBIT-ADMIN-2026';
const ADMIN_EMAIL_PAYLOAD = 'ICAgICADLjMjLDxtXl9RVyM=';
const ADMIN_PASSWORD_PAYLOAD = 'ACAgICBsJSkkJ3wdAAYT';

function json_response(int $status, array $data) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function read_json(): array {
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    return is_array($data) ? $data : [];
}

function route_path(): string {
    $uri = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '';
    $pos = strpos($uri, '/api');
    if ($pos === false) {
        return '/';
    }
    $path = substr($uri, $pos + 4);
    return $path === '' ? '/' : $path;
}

function decode_secret(string $payload, string $saltText): string {
    $encrypted = base64_decode($payload, true);
    if ($encrypted === false) return '';
    $out = '';
    $saltLen = strlen($saltText);
    for ($i = 0, $len = strlen($encrypted); $i < $len; $i++) {
        $out .= chr(ord($encrypted[$i]) ^ ord($saltText[$i % $saltLen]));
    }
    return $out;
}

function admin_credentials(): array {
    return [
        'email' => decode_secret(ADMIN_EMAIL_PAYLOAD, ADMIN_KEY_SALT),
        'password' => decode_secret(ADMIN_PASSWORD_PAYLOAD, ADMIN_KEY_SALT),
    ];
}

function mail_password(): string {
    $env = getenv('EMAIL_PASS');
    $password = $env && trim($env) !== '' ? trim($env) : decode_secret(MAIL_KEY_PAYLOAD, MAIL_KEY_SALT);
    return str_replace(' ', '', $password);
}

function db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    return $pdo;
}

function install_tables(): void {
    db()->exec("CREATE TABLE IF NOT EXISTS users (
        email VARCHAR(190) PRIMARY KEY,
        username VARCHAR(120) NOT NULL,
        password VARCHAR(255) NOT NULL,
        bio TEXT,
        avatar MEDIUMTEXT,
        link VARCHAR(255),
        followers INT DEFAULT 0,
        following INT DEFAULT 0,
        verified TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

    db()->exec("CREATE TABLE IF NOT EXISTS posts (
        id VARCHAR(80) PRIMARY KEY,
        author_email VARCHAR(190) NOT NULL,
        payload MEDIUMTEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_posts_author (author_email)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
}

function row_to_user(?array $row): ?array {
    if (!$row) return null;
    return [
        'email' => $row['email'],
        'username' => $row['username'],
        'password' => $row['password'],
        'bio' => $row['bio'] ?: '',
        'avatar' => $row['avatar'] ?: '/orbit_logo.png',
        'link' => $row['link'] ?: '',
        'followers' => (int)($row['followers'] ?? 0),
        'following' => (int)($row['following'] ?? 0),
        'verified' => (bool)($row['verified'] ?? 1),
    ];
}

function get_user(string $email): ?array {
    $stmt = db()->prepare('SELECT * FROM users WHERE LOWER(email)=LOWER(?) LIMIT 1');
    $stmt->execute([trim($email)]);
    return row_to_user($stmt->fetch() ?: null);
}

function list_users(): array {
    $stmt = db()->query('SELECT * FROM users ORDER BY created_at DESC');
    $users = [];
    foreach ($stmt->fetchAll() as $row) {
        $user = row_to_user($row);
        if ($user) $users[] = $user;
    }
    return $users;
}

function save_user(array $user): array {
    $email = strtolower(trim((string)($user['email'] ?? '')));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_response(400, ['message' => 'Geçerli e-posta gir.']);
    }
    $username = trim((string)($user['username'] ?? ''));
    if ($username === '') $username = explode('@', $email)[0] ?: 'ORBIT Kullanıcısı';
    $password = (string)($user['password'] ?? '');
    $bio = (string)($user['bio'] ?? '');
    $avatar = (string)($user['avatar'] ?? '/orbit_logo.png');
    $link = (string)($user['link'] ?? '');
    $followers = (int)($user['followers'] ?? 0);
    $following = (int)($user['following'] ?? 0);

    $stmt = db()->prepare("INSERT INTO users(email, username, password, bio, avatar, link, followers, following, verified)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE
            username=VALUES(username),
            password=IF(VALUES(password)='', password, VALUES(password)),
            bio=VALUES(bio),
            avatar=VALUES(avatar),
            link=VALUES(link),
            followers=VALUES(followers),
            following=VALUES(following),
            verified=1");
    $stmt->execute([$email, $username, $password, $bio, $avatar, $link, $followers, $following]);
    return get_user($email) ?: [];
}

function delete_user(string $email): bool {
    $email = strtolower(trim($email));
    db()->prepare('DELETE FROM posts WHERE LOWER(author_email)=LOWER(?)')->execute([$email]);
    $stmt = db()->prepare('DELETE FROM users WHERE LOWER(email)=LOWER(?)');
    $stmt->execute([$email]);
    return $stmt->rowCount() > 0;
}

function list_posts(?string $email = null): array {
    if ($email) {
        $stmt = db()->prepare('SELECT payload FROM posts WHERE LOWER(author_email)=LOWER(?) ORDER BY created_at ASC');
        $stmt->execute([trim($email)]);
    } else {
        $stmt = db()->query('SELECT payload FROM posts ORDER BY created_at ASC');
    }
    $posts = [];
    foreach ($stmt->fetchAll() as $row) {
        $post = json_decode((string)$row['payload'], true);
        if (is_array($post)) $posts[] = $post;
    }
    return $posts;
}

function save_post(array $post): array {
    $id = (string)($post['id'] ?? '');
    $authorEmail = strtolower(trim((string)($post['authorEmail'] ?? '')));
    if ($id === '' || $authorEmail === '') {
        json_response(400, ['message' => 'Gönderi id veya kullanıcı e-postası eksik.']);
    }
    $payload = json_encode($post, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $stmt = db()->prepare("INSERT INTO posts(id, author_email, payload)
        VALUES(?, ?, ?)
        ON DUPLICATE KEY UPDATE author_email=VALUES(author_email), payload=VALUES(payload)");
    $stmt->execute([$id, $authorEmail, $payload]);
    return $post;
}

function smtp_send(string $to, string $subject, string $html, string $text = ''): array {
    $password = mail_password();
    $socket = @stream_socket_client('tcp://smtp.gmail.com:587', $errno, $errstr, 20);
    if (!$socket) return [false, "SMTP bağlantısı kurulamadı: $errstr"];
    stream_set_timeout($socket, 20);

    $read = function () use ($socket): string {
        $data = '';
        while (($line = fgets($socket, 515)) !== false) {
            $data .= $line;
            if (isset($line[3]) && $line[3] === ' ') break;
        }
        return $data;
    };
    $cmd = function (string $command, array $ok) use ($socket, $read): array {
        fwrite($socket, $command . "\r\n");
        $reply = $read();
        $code = (int)substr($reply, 0, 3);
        return [in_array($code, $ok, true), $reply];
    };

    $read();
    foreach ([['EHLO orbit.local', [250]], ['STARTTLS', [220]]] as $step) {
        [$ok, $reply] = $cmd($step[0], $step[1]);
        if (!$ok) return [false, trim($reply)];
    }
    if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
        return [false, 'TLS başlatılamadı.'];
    }
    foreach ([['EHLO orbit.local', [250]], ['AUTH LOGIN', [334]], [base64_encode(EMAIL_USER), [334]], [base64_encode($password), [235]], ['MAIL FROM:<' . EMAIL_USER . '>', [250]], ['RCPT TO:<' . $to . '>', [250, 251]], ['DATA', [354]]] as $step) {
        [$ok, $reply] = $cmd($step[0], $step[1]);
        if (!$ok) return [false, trim($reply)];
    }

    $boundary = 'orbit_' . bin2hex(random_bytes(8));
    $body = "From: \"ORBIT\" <" . EMAIL_USER . ">\r\n";
    $body .= "To: <{$to}>\r\n";
    $body .= "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=\r\n";
    $body .= "MIME-Version: 1.0\r\n";
    $body .= "Content-Type: multipart/alternative; boundary=\"{$boundary}\"\r\n\r\n";
    $body .= "--{$boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n" . ($text ?: $subject) . "\r\n\r\n";
    $body .= "--{$boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n{$html}\r\n\r\n--{$boundary}--\r\n.";
    fwrite($socket, $body . "\r\n");
    $reply = $read();
    $sent = (int)substr($reply, 0, 3) === 250;
    $cmd('QUIT', [221]);
    fclose($socket);
    return [$sent, $sent ? 'Mail gönderildi.' : trim($reply)];
}

function otp_email_html(string $code, string $purpose): string {
    $title = $purpose === 'reset' ? 'Şifre sıfırlama' : 'Hesap doğrulama';
    return '<!doctype html><html><body style="margin:0;background:#070814;font-family:Segoe UI,Arial,sans-serif;color:#f4f7ff"><table width="100%" cellspacing="0" cellpadding="0" style="background:#070814;padding:30px 12px"><tr><td align="center"><table width="100%" cellspacing="0" cellpadding="0" style="max-width:590px;background:#111326;border:1px solid rgba(255,255,255,.14);border-radius:24px;overflow:hidden"><tr><td style="padding:30px;background:linear-gradient(135deg,#7c5cff,#00e5ff);color:white"><div style="font-size:13px;font-weight:900;letter-spacing:2px">ORBIT SOCIAL UNIVERSE</div><div style="font-size:32px;font-weight:900;margin-top:8px">' . $title . '</div></td></tr><tr><td style="padding:30px"><div style="font-size:16px;line-height:1.7;color:#dfe6ff">Merhaba, ORBIT hesabını korumak için aşağıdaki tek kullanımlık kodu gir.</div><div style="margin:26px 0;padding:22px;background:#070814;border:1px solid rgba(255,255,255,.14);border-radius:22px;text-align:center"><div style="font-size:12px;color:#9aa4c7;font-weight:900;letter-spacing:1px">6 HANELİ OTP KODU</div><div style="font-size:44px;color:#00e5ff;font-weight:950;letter-spacing:8px;margin-top:10px">' . htmlspecialchars($code, ENT_QUOTES, 'UTF-8') . '</div></div><div style="font-size:14px;line-height:1.7;color:#9aa4c7">Bu kod 5 dakika geçerlidir. Kodu kimseyle paylaşma.</div></td></tr><tr><td style="padding:20px 30px;background:#0b0d1b;color:#9aa4c7;font-size:12px">Destek: ' . SUPPORT_EMAIL . '</td></tr></table></td></tr></table></body></html>';
}

function create_otp(string $email, string $purpose): array {
    $code = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    [$sent, $detail] = smtp_send($email, "ORBIT doğrulama kodun: {$code}", otp_email_html($code, $purpose), "ORBIT doğrulama kodun: {$code}");
    if ($sent) $_SESSION['otp'][$purpose][strtolower($email)] = ['code' => $code, 'expires' => time() + 300];
    return [$sent, $detail];
}

function verify_otp(string $email, string $code, string $purpose): array {
    $key = strtolower(trim($email));
    $item = $_SESSION['otp'][$purpose][$key] ?? null;
    if (!$item) return [false, 'Kod bulunamadı.'];
    if (time() > (int)$item['expires']) return [false, 'Kodun süresi doldu.'];
    if ((string)$item['code'] !== trim($code)) return [false, 'Kod hatalı.'];
    unset($_SESSION['otp'][$purpose][$key]);
    return [true, 'Doğrulama başarılı.'];
}

function notification_email_html(string $message): string {
    $safe = nl2br(htmlspecialchars($message, ENT_QUOTES, 'UTF-8'));
    return '<!doctype html><html><body style="margin:0;background:#070814;font-family:Segoe UI,Arial,sans-serif;color:#f4f7ff"><table width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px;background:#070814"><tr><td align="center"><table width="100%" cellspacing="0" cellpadding="0" style="max-width:590px;background:#111326;border:1px solid rgba(255,255,255,.14);border-radius:22px;overflow:hidden"><tr><td style="padding:28px;background:linear-gradient(135deg,#7c5cff,#00e5ff);color:white"><div style="font-size:30px;font-weight:900">ORBIT Admin Bildirimi</div></td></tr><tr><td style="padding:28px;color:#dfe6ff;font-size:16px;line-height:1.7">' . $safe . '</td></tr><tr><td style="padding:18px 28px;background:#0b0d1b;color:#9aa4c7;font-size:12px">Destek: ' . SUPPORT_EMAIL . '</td></tr></table></td></tr></table></body></html>';
}

function send_admin_notification(string $target, string $subject, string $message): array {
    $recipients = $target === 'all' ? array_column(list_users(), 'email') : [$target];
    $recipients = array_values(array_filter($recipients, fn($email) => filter_var($email, FILTER_VALIDATE_EMAIL)));
    $failed = [];
    foreach ($recipients as $email) {
        [$ok, $detail] = smtp_send($email, $subject, notification_email_html($message), $message);
        if (!$ok) $failed[] = ['email' => $email, 'error' => $detail];
    }
    return ['sent' => count($recipients) - count($failed), 'failed' => $failed];
}

function read_inbox(): array {
    return [['from' => 'Sistem', 'subject' => 'InfinityFree', 'date' => date(DATE_RFC2822), 'body' => 'Gelen kutusu okuma ücretsiz hostinglerde genelde kapalıdır. Admin toplu mail gönderme endpointi ayrıdır.']];
}

try {
    install_tables();
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_response(405, ['message' => 'Sadece POST desteklenir.']);
    $path = route_path();
    $data = read_json();

    if ($path === '/auth/send-register-otp') {
        $email = trim((string)($data['email'] ?? ''));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) json_response(400, ['message' => 'Geçerli e-posta gir.']);
        [$sent, $detail] = create_otp($email, 'register');
        if (!$sent) json_response(500, ['message' => 'Mail gönderilemedi: ' . $detail]);
        json_response(200, ['sent' => true, 'message' => 'Kod mail adresine gönderildi.']);
    }
    if ($path === '/auth/admin-login') {
        $creds = admin_credentials();
        $email = strtolower(trim((string)($data['email'] ?? '')));
        if ($email !== strtolower($creds['email']) || (string)($data['password'] ?? '') !== $creds['password']) json_response(401, ['message' => 'Admin bilgileri hatalı.']);
        json_response(200, ['user' => ['email' => $creds['email'], 'username' => 'ORBIT Admin', 'bio' => 'ORBIT yönetim hesabı', 'avatar' => '/orbit_logo.png', 'link' => '', 'followers' => 0, 'following' => 0, 'verified' => true, 'isAdmin' => true], 'message' => 'Admin girişi başarılı.']);
    }
    if ($path === '/auth/verify-register-otp') {
        [$ok, $message] = verify_otp((string)($data['email'] ?? ''), (string)($data['code'] ?? ''), 'register');
        json_response($ok ? 200 : 400, ['message' => $message]);
    }
    if ($path === '/auth/forgot-password') {
        $email = trim((string)($data['email'] ?? ''));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) json_response(400, ['message' => 'Geçerli e-posta gir.']);
        [$sent, $detail] = create_otp($email, 'reset');
        if (!$sent) json_response(500, ['message' => 'Mail gönderilemedi: ' . $detail]);
        json_response(200, ['sent' => true, 'message' => 'Sıfırlama kodu mail adresine gönderildi.']);
    }
    if ($path === '/auth/reset-password') {
        $email = strtolower(trim((string)($data['email'] ?? '')));
        [$ok, $message] = verify_otp($email, (string)($data['code'] ?? ''), 'reset');
        if (!$ok) json_response(400, ['message' => $message]);
        db()->prepare('UPDATE users SET password=? WHERE LOWER(email)=LOWER(?)')->execute([(string)($data['newPassword'] ?? ''), $email]);
        json_response(200, ['message' => 'Şifre değiştirildi.']);
    }
    if ($path === '/users/get') {
        $user = get_user((string)($data['email'] ?? ''));
        if (!$user) json_response(404, ['message' => 'Kullanıcı bulunamadı.']);
        json_response(200, ['user' => $user]);
    }
    if ($path === '/users/save') json_response(200, ['user' => save_user((array)($data['user'] ?? $data)), 'message' => 'Kullanıcı kaydedildi.']);
    if ($path === '/users/delete') {
        $deleted = delete_user((string)($data['email'] ?? ''));
        json_response($deleted ? 200 : 404, ['deleted' => $deleted, 'message' => $deleted ? 'Hesap silindi.' : 'Kullanıcı bulunamadı.']);
    }
    if ($path === '/users/list') json_response(200, ['users' => list_users()]);
    if ($path === '/posts/list') json_response(200, ['posts' => list_posts($data['email'] ?? null)]);
    if ($path === '/posts/save') json_response(200, ['post' => save_post((array)($data['post'] ?? $data)), 'message' => 'Gönderi kaydedildi.']);
    if ($path === '/admin/send-mail') {
        $message = trim((string)($data['message'] ?? ''));
        if ($message === '') json_response(400, ['message' => 'Bildirim metni boş olamaz.']);
        json_response(200, send_admin_notification((string)($data['target'] ?? ''), (string)($data['subject'] ?? 'ORBIT bildirimi'), $message));
    }
    if ($path === '/admin/inbox') json_response(200, ['messages' => read_inbox()]);

    json_response(404, ['message' => 'Endpoint bulunamadı.']);
} catch (Throwable $e) {
    json_response(500, ['message' => $e->getMessage()]);
}
