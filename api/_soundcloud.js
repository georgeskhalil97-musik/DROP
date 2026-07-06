const crypto = require("crypto");

const TOKEN_URL = "https://secure.soundcloud.com/oauth/token";
const AUTHORIZE_URL = "https://secure.soundcloud.com/authorize";

let cachedAppToken = null;
let cachedAppTokenExpiry = 0;

// Token "app" (client_credentials) — utilisé pour scanner les playlists PUBLIQUES,
// sans connexion utilisateur.
async function getAppAccessToken() {
  const now = Date.now();
  if (cachedAppToken && now < cachedAppTokenExpiry) {
    return cachedAppToken;
  }

  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
  const clientSecret = process.env.SOUNDCLOUD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "SOUNDCLOUD_CLIENT_ID ou SOUNDCLOUD_CLIENT_SECRET manquant dans les variables d'environnement Vercel."
    );
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Échec de l'authentification SoundCloud (${response.status}): ${text}`);
  }

  const data = await response.json();
  cachedAppToken = data.access_token;
  cachedAppTokenExpiry = now + (data.expires_in - 60) * 1000;
  return cachedAppToken;
}

function soundcloudFetch(path, accessToken) {
  return fetch(`https://api.soundcloud.com${path}`, {
    headers: {
      Authorization: `OAuth ${accessToken}`,
      Accept: "application/json; charset=utf-8",
    },
  });
}

// --- PKCE helpers pour le flow "Se connecter avec SoundCloud" ---

function base64url(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function generatePkcePair() {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

function buildAuthorizeUrl({ redirectUri, codeChallenge, state }) {
  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

async function exchangeCodeForUserToken({ code, redirectUri, codeVerifier }) {
  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
  const clientSecret = process.env.SOUNDCLOUD_CLIENT_SECRET;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
      code,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || "Échec de l'échange du code d'autorisation.");
  }
  return data; // { access_token, refresh_token, expires_in, ... }
}

// --- Cookies (parsing/écriture manuelle, sans dépendance externe) ---

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const cookies = {};
  header.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  });
  return cookies;
}

function setCookie(res, name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || "/"}`);
  parts.push("HttpOnly");
  parts.push("Secure");
  parts.push(`SameSite=${options.sameSite || "Lax"}`);
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  const existing = res.getHeader("Set-Cookie");
  const cookieStr = parts.join("; ");
  if (existing) {
    res.setHeader("Set-Cookie", Array.isArray(existing) ? [...existing, cookieStr] : [existing, cookieStr]);
  } else {
    res.setHeader("Set-Cookie", cookieStr);
  }
}

module.exports = {
  getAppAccessToken,
  soundcloudFetch,
  generatePkcePair,
  buildAuthorizeUrl,
  exchangeCodeForUserToken,
  parseCookies,
  setCookie,
};
