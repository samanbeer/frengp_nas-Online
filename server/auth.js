const crypto = require('crypto');
const config = require('./config');

// In-memory active session cache
// Sessions store encrypted credentials to communicate with FTPS on behalf of the user
const sessions = new Map();

// Helper to encrypt sensitive string in memory using AES-256-GCM
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
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const session = {
    id: token,
    user,
    encryptedPassword: encrypt(password),
    createdAt: now,
    lastAccess: now,
    expiresAt: now + config.SESSION_TTL_MS,
  };
  sessions.set(token, session);
  return token;
}

function getSession(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;

  // Check if expired
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }

  // Update lastAccess and slide expiration
  session.lastAccess = Date.now();
  session.expiresAt = session.lastAccess + config.SESSION_TTL_MS;

  const password = decrypt(session.encryptedPassword);
  if (!password) {
    sessions.delete(token);
    return null;
  }

  return {
    id: session.id,
    user: session.user,
    password,
    createdAt: session.createdAt,
    lastAccess: session.lastAccess,
  };
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
