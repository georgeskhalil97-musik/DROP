const { getAppAccessToken, soundcloudFetch, parseCookies } = require("./_soundcloud");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const url = req.query.url;
  if (!url) {
    res.status(400).json({ error: "Paramètre 'url' manquant." });
    return;
  }

  try {
    const cookies = parseCookies(req);
    // Si l'utilisateur est connecté, on utilise SON token (accès à ses playlists
    // privées incluses). Sinon on retombe sur le token app (playlists publiques uniquement).
    const accessToken = cookies.sc_user_token || (await getAppAccessToken());

    const resolveRes = await soundcloudFetch(
      `/resolve?url=${encodeURIComponent(url)}`,
      accessToken
    );

    if (!resolveRes.ok) {
      const errText = await resolveRes.text();
      const isPrivate = resolveRes.status === 401 || resolveRes.status === 403;
      res.status(resolveRes.status).json({
        error: isPrivate && !cookies.sc_user_token
          ? "Cette playlist est privée. Connecte-toi avec SoundCloud (bouton en haut à droite) pour pouvoir la scanner."
          : "Impossible de résoudre cette URL SoundCloud. Vérifie que le lien est correct.",
        details: errText,
      });
      return;
    }

    const resource = await resolveRes.json();

    let rawTracks = [];

    if (resource.kind === "playlist") {
      rawTracks = resource.tracks || [];
    } else if (resource.kind === "user") {
      const tracksRes = await soundcloudFetch(
        `/users/${resource.id}/tracks?limit=50&linked_partitioning=true`,
        accessToken
      );
      if (tracksRes.ok) {
        const tracksData = await tracksRes.json();
        rawTracks = tracksData.collection || [];
      }
    } else if (resource.kind === "track") {
      rawTracks = [resource];
    } else {
      res.status(400).json({ error: `Type de ressource non supporté: ${resource.kind}` });
      return;
    }

    const incompleteIds = rawTracks
      .filter((t) => !t.title && t.id)
      .map((t) => t.id);

    let fullTracksById = {};
    if (incompleteIds.length > 0) {
      const idsParam = incompleteIds.slice(0, 50).join(",");
      const fullRes = await soundcloudFetch(`/tracks?ids=${idsParam}`, accessToken);
      if (fullRes.ok) {
        const fullData = await fullRes.json();
        fullTracksById = Object.fromEntries(fullData.map((t) => [t.id, t]));
      }
    }

    function detectExternalPlatform(purchaseUrl) {
      if (!purchaseUrl) return null;
      let hostname = "";
      try {
        hostname = new URL(purchaseUrl).hostname.replace(/^www\./, "");
      } catch {
        return null;
      }
      if (hostname.includes("hypeddit.com")) return { name: "Hypeddit", confirmedFree: true };
      if (hostname.includes("toneden.io")) return { name: "Toneden", confirmedFree: true };
      if (hostname.includes("bandcamp.com")) return { name: "Bandcamp", confirmedFree: false };
      if (hostname.includes("beatport.com")) return { name: "Beatport", confirmedFree: false };
      if (hostname.includes("fanlink") || hostname.includes("linkfire.com") || hostname.includes("feature.fm")) return { name: "Lien externe", confirmedFree: false };
      return { name: "Lien externe", confirmedFree: false };
    }

    const tracks = rawTracks.map((t) => {
      const full = fullTracksById[t.id] || t;
      const nativelyFree = Boolean(full.downloadable);
      const purchaseUrl = full.purchase_url || null;
      const externalPlatform = !nativelyFree ? detectExternalPlatform(purchaseUrl) : null;

      return {
        id: full.id,
        title: full.title || "Titre indisponible",
        artist: full.user?.username || "Artiste inconnu",
        free: nativelyFree,
        externalPlatform: externalPlatform?.name || null, // ex: "Hypeddit", "Bandcamp", ou null
        externalConfirmedFree: externalPlatform?.confirmedFree || false,
        externalUrl: externalPlatform ? purchaseUrl : null,
        permalink: full.permalink_url,
      };
    });

    res.status(200).json({
      playlistTitle: resource.title || resource.username || "Playlist",
      tracks,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
