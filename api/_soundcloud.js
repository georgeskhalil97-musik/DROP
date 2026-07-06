// Fonctions partagées pour parler à l'API SoundCloud depuis le backend.
// Ce fichier n'est PAS un endpoint (préfixe _), Vercel ne le déploie pas comme route.

let cachedToken = null;
let cachedTokenExpiry = 0;

async function getAccessToken() {
  const now = Date.now();

  // On réutilise le token tant qu'il n'est pas expiré, pour éviter
  // de redemander un nouveau token à chaque appel.
  if (cachedToken && now < cachedTokenExpiry) {
    return cachedToken;
  }

  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
  const clientSecret = process.env.SOUNDCLOUD_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "SOUNDCLOUD_CLIENT_ID ou SOUNDCLOUD_CLIENT_SECRET manquant dans les variables d'environnement Vercel."
    );
  }

  const response = await fetch("https://api.soundcloud.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Échec de l'authentification SoundCloud (${response.status}): ${text}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  // On garde une marge de sécurité de 60s avant l'expiration réelle.
  cachedTokenExpiry = now + (data.expires_in - 60) * 1000;

  return cachedToken;
}

async function soundcloudFetch(path, accessToken) {
  const response = await fetch(`https://api.soundcloud.com${path}`, {
    headers: {
      Authorization: `OAuth ${accessToken}`,
      Accept: "application/json; charset=utf-8",
    },
  });
  return response;
}

module.exports = { getAccessToken, soundcloudFetch };
