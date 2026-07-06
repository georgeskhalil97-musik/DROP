const { getAppAccessToken, parseCookies } = require("./_soundcloud");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const trackId = req.query.id;
  if (!trackId) {
    res.status(400).json({ error: "Paramètre 'id' manquant." });
    return;
  }

  try {
    const cookies = parseCookies(req);
    const accessToken = cookies.sc_user_token || (await getAppAccessToken());

    const downloadRes = await fetch(
      `https://api.soundcloud.com/tracks/${trackId}/download`,
      { headers: { Authorization: `OAuth ${accessToken}` } }
    );

    if (downloadRes.status === 404) {
      res.status(404).json({
        error: "Cette track n'est pas (ou plus) proposée en free download par son artiste.",
      });
      return;
    }

    if (!downloadRes.ok) {
      const text = await downloadRes.text();
      res.status(downloadRes.status).json({ error: "Échec de la récupération du lien.", details: text });
      return;
    }

    const contentType = downloadRes.headers.get("content-type") || "";

    // Cas 1 — SoundCloud renvoie du JSON avec un lien de redirection vers le fichier.
    if (contentType.includes("application/json")) {
      const data = await downloadRes.json();
      if (data.redirectUri) {
        res.redirect(302, data.redirectUri);
        return;
      }
      res.status(200).json(data);
      return;
    }

    // Cas 2 — SoundCloud renvoie directement le fichier audio brut (WAV, MP3, etc.).
    // On le retransmet tel quel, avec les bons en-têtes pour déclencher un vrai téléchargement.
    const arrayBuffer = await downloadRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const extension = contentType.includes("wav")
      ? "wav"
      : contentType.includes("mpeg") || contentType.includes("mp3")
      ? "mp3"
      : contentType.includes("flac")
      ? "flac"
      : "audio";

    res.setHeader("Content-Type", contentType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="track-${trackId}.${extension}"`);
    res.status(200).send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
