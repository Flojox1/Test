const json = (data, status = 200, origin = "*") => new Response(JSON.stringify(data), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store"
  }
});

let cachedAccessToken = null;
let cachedAccessTokenUntil = 0;

function base64url(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("");
}

async function verifyFirebaseToken(idToken, env) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken })
  });
  const body = await response.json().catch(() => ({}));
  const user = body.users?.[0];
  if (!response.ok || !user?.localId) {
    throw new Error("Oturum geçersiz. Tekrar giriş yap.");
  }
  return { uid: user.localId, email: user.email || "", emailVerified: !!user.emailVerified };
}

function pemToArrayBuffer(pem) {
  const base64 = pem.replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "").replace(/\s/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getGoogleAccessToken(env) {
  if (cachedAccessToken && Date.now() < cachedAccessTokenUntil) return cachedAccessToken;
  const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  const now = Math.floor(Date.now() / 1000);
  const unsigned = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" })) + "." +
    base64url(JSON.stringify({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/firebase.database",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600
    }));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const assertion = unsigned + "." + base64url(signature);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) throw new Error("Firebase yönetici yetkisi alınamadı.");
  cachedAccessToken = body.access_token;
  cachedAccessTokenUntil = Date.now() + Math.max(60, Number(body.expires_in || 3600) - 120) * 1000;
  return cachedAccessToken;
}

async function markEmailVerified(uid, env) {
  const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  const accessToken = await getGoogleAccessToken(env);
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${serviceAccount.project_id}/accounts:update`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ localId: uid, emailVerified: true })
    }
  );
  if (!response.ok) {
    console.error("Firebase account update failed", await response.text());
    throw new Error("Firebase hesabı doğrulanamadı. Servis hesabı yetkisini kontrol et.");
  }
}

async function sendBrevoEmail(email, code, env) {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "accept": "application/json",
      "api-key": env.BREVO_API_KEY,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      sender: { name: "FloRod", email: env.BREVO_SENDER_EMAIL },
      to: [{ email }],
      subject: "FloRod e-posta doğrulama kodun",
      textContent: `FloRod hesabını doğrulamak için kodun: ${code}. Bu kod 5 dakika geçerlidir.`,
      htmlContent: `<div style="font-family:Arial;background:#101014;color:#eee;padding:28px"><h2>FloRod</h2><p>Doğrulama kodun:</p><div style="font-size:32px;letter-spacing:8px;font-weight:bold;padding:18px;background:#08080a">${code}</div><p>Bu kod 5 dakika geçerlidir.</p></div>`
    })
  });
  if (!response.ok) {
    console.error("Brevo send failed", await response.text());
    throw new Error("E-posta gönderilemedi. Brevo gönderici/API ayarlarını kontrol et.");
  }
}

async function handleSendCode(request, env) {
  const idToken = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!idToken) return json({ error: "Oturum bulunamadı. Tekrar giriş yap." }, 401);
  const user = await verifyFirebaseToken(idToken, env);
  if (user.emailVerified) return json({ error: "E-posta zaten doğrulanmış." }, 409);

  const key = `email-code:${user.uid}`;
  const previous = await env.EMAIL_CODES.get(key, "json");
  const now = Date.now();
  if (previous?.sentAt && now - previous.sentAt < 60_000) {
    return json({ error: "Yeni kod istemeden önce 60 saniye bekle." }, 429);
  }

  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  const code = String(random[0] % 1_000_000).padStart(6, "0");
  const hash = await sha256(`${env.CODE_PEPPER}:${user.uid}:${code}`);
  await env.EMAIL_CODES.put(key, JSON.stringify({
    hash,
    expiresAt: now + 300_000,
    sentAt: now,
    attempts: 0
  }), { expirationTtl: 300 });

  try {
    await sendBrevoEmail(user.email, code, env);
  } catch (error) {
    await env.EMAIL_CODES.delete(key);
    throw error;
  }
  return json({ success: true, expiresInSeconds: 300 });
}

async function handleVerifyCode(request, env) {
  const idToken = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!idToken) return json({ error: "Oturum bulunamadı. Tekrar giriş yap." }, 401);
  const user = await verifyFirebaseToken(idToken, env);
  if (user.emailVerified) return json({ success: true, verified: true });

  const key = `email-code:${user.uid}`;
  const record = await env.EMAIL_CODES.get(key, "json");
  if (!record || record.expiresAt < Date.now()) {
    await env.EMAIL_CODES.delete(key);
    return json({ error: "Kodun süresi dolmuş. Yeni kod iste." }, 400);
  }
  if (record.attempts >= 5) return json({ error: "Çok fazla yanlış deneme. Yeni kod iste." }, 429);

  const body = await request.json().catch(() => ({}));
  const code = String(body.code || "").trim();
  if (!/^\d{6}$/.test(code)) return json({ error: "6 haneli kodu gir." }, 400);

  const submittedHash = await sha256(`${env.CODE_PEPPER}:${user.uid}:${code}`);
  if (submittedHash !== record.hash) {
    record.attempts += 1;
    const ttl = Math.max(1, Math.ceil((record.expiresAt - Date.now()) / 1000));
    await env.EMAIL_CODES.put(key, JSON.stringify(record), { expirationTtl: ttl });
    return json({ error: record.attempts >= 5 ? "Çok fazla yanlış deneme. Yeni kod iste." : "Kod hatalı." }, 400);
  }

  await markEmailVerified(user.uid, env);
  await env.EMAIL_CODES.delete(key);
  return json({ success: true, verified: true });
}


const ADMIN_UID = "florod-admin";
const DATABASE_URL = "https://chat-f3082-default-rtdb.europe-west1.firebasedatabase.app";

async function signAdminCustomToken(env) {
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  const now = Math.floor(Date.now() / 1000);
  const unsigned = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" })) + "." +
    base64url(JSON.stringify({
      iss: sa.client_email, sub: sa.client_email,
      aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
      iat: now, exp: now + 3600,
      uid: ADMIN_UID, claims: { admin: true }
    }));
  const key = await crypto.subtle.importKey("pkcs8", pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  return unsigned + "." + base64url(signature);
}

async function requireAdmin(request, env) {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Admin oturumu gerekli.");
  const user = await verifyFirebaseToken(token, env);
  if (user.uid !== ADMIN_UID) throw new Error("Bu işlem için yönetici yetkisi gerekli.");
  return user;
}

async function dbRequest(path, env, method = "GET", value) {
  const accessToken = await getGoogleAccessToken(env);
  const response = await fetch(`${DATABASE_URL}/${path}.json?access_token=${encodeURIComponent(accessToken)}`, {
    method, headers: { "Content-Type": "application/json" },
    ...(method === "GET" || method === "DELETE" ? {} : { body: JSON.stringify(value) })
  });
  const rawBody = await response.text().catch(() => "");
  let body = null;
  try { body = rawBody ? JSON.parse(rawBody) : null; } catch { body = rawBody.slice(0, 500); }
  if (!response.ok) {
    const detail = typeof body === "string" ? body : (body?.error || body?.message || JSON.stringify(body));
    throw new Error(`Firebase HTTP ${response.status}: ${String(detail || "Bilinmeyen veritabanı hatası").slice(0, 500)}`);
  }
  return body;
}

async function handleAdminLogin(request, env) {
  const body = await request.json().catch(() => ({}));
  if (!env.ADMIN_PASSWORD) return json({ error: "Cloudflare'da ADMIN_PASSWORD secret tanımlı değil." }, 503);
  const supplied = String(body.password || "");
  const a = await sha256(supplied);
  const b = await sha256(String(env.ADMIN_PASSWORD));
  if (String(body.username || "").trim().toLowerCase() !== "admin" || a !== b) {
    return json({ error: "Yönetici kullanıcı adı veya şifresi hatalı." }, 401);
  }
  return json({ customToken: await signAdminCustomToken(env) });
}

async function handleAdminApi(request, env, pathname) {
  await requireAdmin(request, env);
  if (pathname === "/admin/players" && request.method === "GET") {
    const users = await dbRequest("users", env) || {};
    const ids = Object.keys(users);
    let accounts = [];
    if (ids.length) {
      const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
      const accessToken = await getGoogleAccessToken(env);
      const response = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${sa.project_id}/accounts:batchGet`, {
        method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ localIds: ids.slice(0, 1000) })
      });
      const data = await response.json().catch(() => ({}));
      accounts = data.users || [];
    }
    const emailById = Object.fromEntries(accounts.map(u => [u.localId, u.email || ""]));
    return json({ players: ids.map(uid => ({
      uid, email: emailById[uid] || "",
      name: users[uid]?.profile?.name || users[uid]?.gameSave?.playerName || "İsimsiz oyuncu",
      money: Number(users[uid]?.gameSave?.money || 0)
    })) });
  }
  if (pathname === "/admin/player-action" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const uid = String(body.uid || "");
    if (!uid || uid === ADMIN_UID) return json({ error: "Oyuncu seçimi geçersiz." }, 400);
    if (body.action === "addMoney") {
      const save = await dbRequest(`users/${encodeURIComponent(uid)}/gameSave`, env) || {};
      save.money = Math.max(0, Number(save.money) || 0) + Math.max(0, Math.min(100000000, Number(body.amount) || 0));
      await dbRequest(`users/${encodeURIComponent(uid)}/gameSave`, env, "PUT", save);
    } else if (body.action === "reset") {
      await dbRequest(`users/${encodeURIComponent(uid)}/gameSave`, env, "PUT", null);
    } else if (body.action === "ban" || body.action === "unban") {
      const banned = body.action === "ban";
      await dbRequest(`banned/${encodeURIComponent(uid)}`, env, "PUT", banned ? true : null);
      const accessToken = await getGoogleAccessToken(env);
      const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
      const response = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${sa.project_id}/accounts:update`, {
        method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ localId: uid, disableUser: banned })
      });
      if (!response.ok) throw new Error("Hesap ban durumu değiştirilemedi.");
    } else return json({ error: "Bilinmeyen işlem." }, 400);
    return json({ success: true });
  }
  if (pathname === "/admin/chat" && request.method === "GET") {
    const messages = await dbRequest("chat", env) || {};
    const enabled = await dbRequest("settings/chatEnabled", env);
    return json({ messages: Object.entries(messages).slice(-100).map(([id, msg]) => ({ id, ...msg })), chatEnabled: enabled !== false });
  }
  if (pathname === "/admin/chat-action" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (body.action === "toggle") {
      await dbRequest("settings/chatEnabled", env, "PUT", !!body.enabled);
    } else if (body.action === "clear") {
      await dbRequest("chat", env, "DELETE");
    } else if (body.action === "delete" && body.id) {
      await dbRequest(`chat/${encodeURIComponent(String(body.id))}`, env, "DELETE");
    } else return json({ error: "Bilinmeyen sohbet işlemi." }, 400);
    return json({ success: true });
  }
  return json({ error: "Admin endpoint bulunamadı." }, 404);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "*";
    if (request.method === "OPTIONS") return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Vary": "Origin"
      }
    });
    const url = new URL(request.url);
    if (request.method !== "POST" && !(request.method === "GET" && url.pathname.startsWith("/admin/"))) return json({ error: "Method not allowed" }, 405, origin);
    try {
      let response;
      if (url.pathname === "/admin-login") response = await handleAdminLogin(request, env);
      else if (url.pathname.startsWith("/admin/")) response = await handleAdminApi(request, env, url.pathname);
      else if (url.pathname === "/send-code") response = await handleSendCode(request, env);
      else if (url.pathname === "/verify-code") response = await handleVerifyCode(request, env);
      else response = json({ error: "Not found" }, 404, origin);
      const headers = new Headers(response.headers);
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Vary", "Origin");
      return new Response(response.body, { status: response.status, headers });
    } catch (error) {
      console.error(error);
      return json({ error: error.message || "Sunucu hatası." }, 500, origin);
    }
  }
};
