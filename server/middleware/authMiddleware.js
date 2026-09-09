const { getSession } = require('../auth');

function authMiddleware(req, res, next) {
  let token = req.cookies && req.cookies.nas_session;

  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (!token) {
    return res.status(401).json({
      error: 'Neautorizovaný přístup. Přihlaste se prosím.',
      code: 'UNAUTHORIZED',
    });
  }

  const session = getSession(token);
  if (!session) {
    res.clearCookie('nas_session');
    return res.status(401).json({
      error: 'Platnost relace vypršela. Přihlaste se prosím znovu.',
      code: 'SESSION_EXPIRED',
    });
  }

  req.session = session;
  req.credentials = {
    user: session.user,
    password: session.password,
  };

  next();
}

module.exports = authMiddleware;
