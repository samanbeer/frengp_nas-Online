const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const config = require('../config');

const DEPLOY_SECRET = process.env.DEPLOY_SECRET || config.SESSION_SECRET;

function verifySignature(req) {
  // 1. Direct secret in header or query parameter
  const headerSecret = req.headers['x-deploy-secret'];
  const querySecret = req.query.secret;
  if ((headerSecret && headerSecret === DEPLOY_SECRET) || (querySecret && querySecret === DEPLOY_SECRET)) {
    return true;
  }

  // 2. GitHub HMAC SHA-256 signature
  const ghSignature = req.headers['x-hub-signature-256'];
  if (ghSignature && DEPLOY_SECRET) {
    const rawBody = JSON.stringify(req.body);
    const expected = 'sha256=' + crypto.createHmac('sha256', DEPLOY_SECRET).update(rawBody).digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(ghSignature), Buffer.from(expected));
    } catch (_) {
      return false;
    }
  }

  return false;
}

function runDeploy() {
  const rootDir = path.resolve(__dirname, '../..');
  const logFile = '/home/ubuntu/deploy.log';
  const script = `
    export PATH="/usr/local/bin:/usr/bin:/bin:${rootDir}/node_modules/.bin:$PATH"
    echo "=========================================" >> ${logFile}
    echo "🚀 Auto-deploy started: $(date)" >> ${logFile}
    cd ${rootDir}
    git fetch origin main >> ${logFile} 2>&1
    git reset --hard origin/main >> ${logFile} 2>&1
    npm install --include=dev >> ${logFile} 2>&1
    npm run build >> ${logFile} 2>&1
    echo "✅ Build completed successfully at $(date)" >> ${logFile}
    echo "🔄 Restarting nas-website service..." >> ${logFile}
    sleep 1 && sudo systemctl restart nas-website >> ${logFile} 2>&1
  `;

  const child = spawn('bash', ['-c', script], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

// GitHub webhook receiver
router.post('/github', (req, res) => {
  if (!verifySignature(req)) {
    return res.status(401).json({ error: 'Neplatný bezpečnostní token (Unauthorized).' });
  }

  // If GitHub push event, check branch
  if (req.body && req.body.ref && req.body.ref !== 'refs/heads/main') {
    return res.json({
      success: true,
      message: `Ignoruji push do větve ${req.body.ref} (nasazuje se pouze main).`,
    });
  }

  runDeploy();

  res.json({
    success: true,
    message: 'Nasazení (Auto-deploy) bylo úspěšně zahájeno na pozadí.',
    timestamp: new Date().toISOString(),
  });
});

// View deploy logs
router.get('/logs', (req, res) => {
  const querySecret = req.query.secret;
  if (!querySecret || querySecret !== DEPLOY_SECRET) {
    return res.status(401).json({ error: 'Neautorizováno.' });
  }

  const logFile = '/home/ubuntu/deploy.log';
  if (!fs.existsSync(logFile)) {
    return res.type('text/plain').send('Zatím nebyl zaznamenán žádný běh auto-deploy.');
  }

  const content = fs.readFileSync(logFile, 'utf8');
  const lines = content.split('\n');
  const lastLines = lines.slice(-100).join('\n');
  res.type('text/plain').send(lastLines);
});

module.exports = router;
