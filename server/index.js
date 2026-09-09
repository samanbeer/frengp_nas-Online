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

// CORS configuration
app.use(
  cors({
    origin: true,
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

// Production: serve built static frontend files
const distPath = path.join(__dirname, '../client/dist');
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

app.listen(config.PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 NAS File Manager Server běží na portu: ${config.PORT}`);
  console.log(`📁 FTPS Cíl: ftps://${config.FTPS_HOST}:${config.FTPS_PORT}`);
  console.log(`👤 Výchozí uživatel: ${config.FTPS_USER}`);
  console.log(`🌐 Prostředí: ${config.NODE_ENV}`);
  console.log(`=========================================`);
});
