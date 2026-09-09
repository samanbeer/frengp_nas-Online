const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');
const { apiLimiter } = require('./middleware/rateLimiter');

const app = express();

// Trust reverse proxy (Vercel, Cloudflare, Nginx) for proper IP rate-limiting and secure cookies
app.set('trust proxy', 1);

// Security HTTP headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        mediaSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// Whitelisted CORS origins
const allowedOrigins = [
  'https://salat.fit',
  'https://www.salat.fit',
  'http://localhost:5173',
  'http://localhost:5000',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5000',
  ...config.ALLOWED_ORIGINS,
];

// CORS configuration with whitelist protection
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, same-origin browser navigations, curl)
      if (!origin) return callback(null, true);

      // Check explicit allowed origins
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Allow salat.fit and any subdomains (*.salat.fit)
      if (/^https:\/\/(?:[a-zA-Z0-9-]+\.)*salat\.fit$/.test(origin)) {
        return callback(null, true);
      }

      // Allow Vercel preview environments (*.vercel.app)
      if (/^https:\/\/[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.vercel\.app$/.test(origin)) {
        return callback(null, true);
      }

      // Reject all unauthorized origins gracefully (without 500 error)
      return callback(null, false);
    },
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// General API rate limiting
app.use('/api', apiLimiter);

// API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'NAS File Manager',
    ftpsHost: config.FTPS_HOST,
    timestamp: new Date().toISOString(),
  });
});

// Production: serve built static frontend files if present (used in standalone node server)
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  // SPA fallback for all non-API GET routes
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    error: 'Nastala neočekávaná chyba serveru.',
    message: err.message,
  });
});

module.exports = app;
