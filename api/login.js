const crypto = require("crypto");
const { generatePkcePair, buildAuthorizeUrl, setCookie } = require("./_soundcloud");

module.exports = async (req, res) => {
  const { verifier, challenge } = generatePkcePair();
  const state = crypto.randomBytes(16).toString("hex");

  // On déduit l'URL de redirection depuis l'hôte de la requête, pour que ça
  // fonctionne aussi bien en local qu'en production sans configuration en dur.
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const redirectUri = `${protocol}://${host}/api/callback`;

  setCookie(res, "sc_verifier", verifier, { maxAge: 600 });
  setCookie(res, "sc_state", state, { maxAge: 600 });

  const authorizeUrl = buildAuthorizeUrl({ redirectUri, codeChallenge: challenge, state });
  res.redirect(302, authorizeUrl);
};
