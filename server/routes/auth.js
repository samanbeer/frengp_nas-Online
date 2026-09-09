const express = require('express');
const router = express.Router();
const config = require('../config');
const { testConnection } = require('../ftps');
const { createSession, destroySession } = require('../auth');
const authMiddleware = require('../middleware/authMiddleware');
const { loginLimiter } = require('../middleware/rateLimiter');

// Public config: host & port only (no credentials leaked)
router.get('/config', (req, res) => {
  res.json({
    host: config.FTPS_HOST,
    port: config.FTPS_PORT,
    hasDefaultUser: Boolean(config.FTPS_USER),
  });
});

// Login endpoint
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { password, username } = req.body;
    const user = (username && username.trim()) || config.FTPS_USER;

    if (!user) {
      return res.status(400).json({
        error: 'Zadejte prosím uživatelské jméno.',
        code: 'MISSING_USERNAME',
      });
    }

    if (!password) {
      return res.status(400).json({
        error: 'Zadejte prosím heslo k NAS serveru.',
        code: 'MISSING_PASSWORD',
      });
    }

    // Verify credentials directly with FTPS server
    try {
      await testConnection({ user, password });
    } catch (ftpError) {
      console.error('FTPS login error:', ftpError.message || ftpError);
      return res.status(401).json({
        error: 'Chyba přihlášení: Nesprávné heslo nebo nedostupný FTPS server.',
        code: 'AUTH_FAILED',
        details: config.IS_PRODUCTION ? undefined : ftpError.message,
      });
    }

    // Credentials valid! Create secure session
    const token = createSession(user, password);

    // Set secure HttpOnly cookie
    res.cookie('nas_session', token, {
      httpOnly: true,
      secure: config.IS_PRODUCTION,
      sameSite: 'lax',
      path: '/',
      maxAge: config.SESSION_TTL_MS,
    });

    res.json({
      success: true,
      user: {
        username: user,
        host: config.FTPS_HOST,
      },
    });
  } catch (err) {
    console.error('Login route error:', err);
    res.status(500).json({
      error: 'Došlo k neočekávané chybě při přihlašování.',
      code: 'SERVER_ERROR',
    });
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  const token = req.cookies && req.cookies.nas_session;
  if (token) {
    destroySession(token);
  }
  res.clearCookie('nas_session', {
    httpOnly: true,
    secure: config.IS_PRODUCTION,
    sameSite: 'lax',
    path: '/',
  });
  res.json({ success: true, message: 'Byli jste úspěšně odhlášeni.' });
});

// Check current authentication session
router.get('/me', authMiddleware, (req, res) => {
  res.json({
    authenticated: true,
    user: {
      username: req.session.user,
      host: config.FTPS_HOST,
    },
  });
});

module.exports = router;
