const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minut
  max: 20, // max 20 pokusů o přihlášení z jedné IP za 15 minut
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Příliš mnoho neúspěšných pokusů o přihlášení. Zkuste to prosím za 15 minut.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minut
  max: 600, // 600 requestů za 5 minut
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Příliš mnoho požadavků. Počkejte prosím chvíli.',
    code: 'API_RATE_LIMIT',
  },
});

module.exports = {
  loginLimiter,
  apiLimiter,
};
