const crypto = require('crypto');
const config = require('./config');

// In-memory active session cache for local speed
const sessions = new Map();

// Helper to encrypt sensitive JSON payload using AES-256-GCM
function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash('sha256').update(config.SESSION_SECRET).digest();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

// Helper to decrypt
function decrypt(ciphertext) {
  try {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) return null;
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const key = crypto.createHash('sha256').update(config.SESSION_SECRET).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return null;
  }
}

function createSession(user, password) {
  const now = Date.now();
  const expiresAt = now + config.SESSION_TTL_MS;

  // Stateless encrypted payload: works across any serverless instance (Vercel)
  const payload = JSON.stringify({
    user,
    password,
    exp: expiresAt,
    iat: now,
  });

  const token = encrypt(payload);

  // Also cache in memory for local speed
  sessions.set(token, {
    user,
    password,
    expiresAt,
    lastAccess: now,
  });

  return token;
}

function getSession(token) {
  if (!token) return null;

  // 1. Check in-memory cache
  const cached = sessions.get(token);
  if (cached) {
    if (Date.now() > cached.expiresAt) {
      sessions.delete(token);
      return null;
    }
    cached.lastAccess = Date.now();
    return {
      id: token,
      user: cached.user,
      password: cached.password,
    };
  }

  // 2. Fallback: decrypt stateless token (crucial for Vercel serverless cold starts)
  const decrypted = decrypt(token);
  if (!decrypted) return null;

  try {
    const data = JSON.parse(decrypted);
    if (!data.user || !data.password || !data.exp) return null;

    if (Date.now() > data.exp) {
      return null;
    }

    // Populate memory cache
    sessions.set(token, {
      user: data.user,
      password: data.password,
      expiresAt: data.exp,
      lastAccess: Date.now(),
    });

    return {
      id: token,
      user: data.user,
      password: data.password,
    };
  } catch (e) {
    return null;
  }
}

function destroySession(token) {
  if (token) {
    sessions.delete(token);
  }
}

// Clean expired sessions periodically
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(token);
    }
  }
}, 5 * 60 * 1000);

if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

module.exports = {
  createSession,
  getSession,
  destroySession,
};
