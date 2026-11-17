const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'priority-usage.json');

/**
 * Returns the ISO week key (e.g. "2026-W47") in Europe/Prague local time,
 * resetting every Monday at 00:00.
 */
function getCurrentWeekKey(date = new Date()) {
  const pragueStr = date.toLocaleString('sv-SE', { timeZone: 'Europe/Prague' }); // "YYYY-MM-DD HH:mm:ss"
  const [y, m, d] = pragueStr.split(' ')[0].split('-').map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d));
  const dayNum = utcDate.getUTCDay() || 7; // Mon=1 .. Sun=7
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((utcDate - yearStart) / 86400000 + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function loadStore() {
  const currentWeek = getCurrentWeekKey();
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.weekKey === currentWeek && parsed.counts && typeof parsed.counts === 'object') {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to load priority store:', err.message);
  }
  return { weekKey: currentWeek, counts: {} };
}

let store = loadStore();

function saveStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpFile = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(store, null, 2), 'utf8');
    fs.renameSync(tmpFile, DATA_FILE);
  } catch (err) {
    console.error('Failed to save priority store:', err.message);
  }
}

function ensureCurrentWeek() {
  const currentWeek = getCurrentWeekKey();
  if (store.weekKey !== currentWeek) {
    store = { weekKey: currentWeek, counts: {} };
    saveStore();
  }
}

function getClientIp(req) {
  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.trim()) {
    return cfIp.trim();
  }
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  return req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
}

/**
 * Derives an irreversible hash combining IP + browser/device fingerprint
 * so Incognito windows on the same device share the weekly Priority quota.
 */
function deriveFingerprintKey(req, rawFingerprint) {
  const ip = getClientIp(req);
  const fp = typeof rawFingerprint === 'string' && rawFingerprint.trim()
    ? rawFingerprint.trim().slice(0, 256)
    : `ua:${req.headers['user-agent'] || 'unknown'}`;

  return crypto
    .createHmac('sha256', config.SESSION_SECRET)
    .update(`${ip}::${fp}`)
    .digest('hex')
    .slice(0, 32);
}

function getPriorityStatus(fingerprintKey) {
  ensureCurrentWeek();
  const max = config.PRIORITY_MAX_PER_WEEK;
  const used = (fingerprintKey && store.counts[fingerprintKey]) || 0;
  return {
    used,
    remaining: Math.max(0, max - used),
    max,
    weekKey: store.weekKey,
  };
}

function consumePriority(fingerprintKey) {
  ensureCurrentWeek();
  const max = config.PRIORITY_MAX_PER_WEEK;
  const used = (fingerprintKey && store.counts[fingerprintKey]) || 0;

  if (used >= max) {
    return {
      ok: false,
      used,
      remaining: 0,
      max,
      weekKey: store.weekKey,
    };
  }

  const nextUsed = used + 1;
  store.counts[fingerprintKey] = nextUsed;
  saveStore();

  return {
    ok: true,
    used: nextUsed,
    remaining: Math.max(0, max - nextUsed),
    max,
    weekKey: store.weekKey,
  };
}

/**
 * Signs and verifies a per-browser queue client ID cookie (`nas_client_id`)
 * to prevent a single browser from opening multiple tabs to occupy multiple slots,
 * while keeping identical school lab PCs independent in the queue.
 */
function signClientId(id) {
  const sig = crypto
    .createHmac('sha256', config.SESSION_SECRET)
    .update(id)
    .digest('hex')
    .slice(0, 16);
  return `${id}.${sig}`;
}

function verifyClientId(signedValue) {
  if (!signedValue || typeof signedValue !== 'string') return null;
  const parts = signedValue.split('.');
  if (parts.length !== 2) return null;
  const [id, sig] = parts;
  if (!id || !sig) return null;
  const expected = crypto
    .createHmac('sha256', config.SESSION_SECRET)
    .update(id)
    .digest('hex')
    .slice(0, 16);
  try {
    if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return id;
    }
  } catch (_) {
    return null;
  }
  return null;
}

function getOrCreateQueueClientId(req, res) {
  const existing = verifyClientId(req.cookies && req.cookies.nas_client_id);
  if (existing) return existing;

  const newId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
  if (res && !res.headersSent) {
    const isSecure = Boolean(
      req.secure || req.headers['x-forwarded-proto'] === 'https' || config.IS_PRODUCTION
    );
    res.cookie('nas_client_id', signClientId(newId), {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }
  return newId;
}

module.exports = {
  getPriorityStatus,
  consumePriority,
  deriveFingerprintKey,
  getOrCreateQueueClientId,
};
