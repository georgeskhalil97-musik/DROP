const { getAccessToken } = require("./_soundcloud");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const trackId = req.query.id;
  if (!trackId) {
    res.status(400).json({ error: "Paramètre 'id' manquant." });
    return;
  }

  try {
    const accessToken = await getAccessToken();

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

    const data = await downloadRes.json();

    // La réponse contient un lien de redirection direct vers le fichier original.
    if (data.redirectUri) {
      res.redirect(302, data.redirectUri);
      return;
    }

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
