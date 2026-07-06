const { exchangeCodeForUserToken, parseCookies, setCookie } = require("./_soundcloud");

module.exports = async (req, res) => {
  const { code, state, error } = req.query;
  const cookies = parseCookies(req);

  if (error) {
    res.redirect(302, `/?login_error=${encodeURIComponent(error)}`);
    return;
  }

  if (!code || !state || state !== cookies.sc_state) {
    res.redirect(302, `/?login_error=${encodeURIComponent("État invalide ou expiré, réessaie.")}`);
    return;
  }

  if (!cookies.sc_verifier) {
    res.redirect(302, `/?login_error=${encodeURIComponent("Session de connexion expirée, réessaie.")}`);
    return;
  }

  try {
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers.host;
    const redirectUri = `${protocol}://${host}/api/callback`;

    const tokenData = await exchangeCodeForUserToken({
      code,
      redirectUri,
      codeVerifier: cookies.sc_verifier,
    });

    // Le token utilisateur est stocké dans un cookie httpOnly — jamais exposé au JS du navigateur.
    setCookie(res, "sc_user_token", tokenData.access_token, { maxAge: tokenData.expires_in || 3600 });
    if (tokenData.refresh_token) {
      setCookie(res, "sc_user_refresh", tokenData.refresh_token, { maxAge: 60 * 60 * 24 * 30 });
    }

    res.redirect(302, "/?connected=1");
  } catch (err) {
    res.redirect(302, `/?login_error=${encodeURIComponent(err.message)}`);
  }
};
