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
  max: 3000, // dostatečný limit i pro celou školní učebnu za jednou veřejnou IP
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/queue/stream',
  message: {
    error: 'Příliš mnoho požadavků. Počkejte prosím chvíli.',
    code: 'API_RATE_LIMIT',
  },
});

module.exports = {
  loginLimiter,
  apiLimiter,
};
