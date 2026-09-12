const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const os = require('os');
const multer = require('multer');
const mime = require('mime-types');
const authMiddleware = require('../middleware/authMiddleware');
const ftps = require('../ftps');

// Protect all file routes with authMiddleware
router.use(authMiddleware);

// Configure multer temp storage
const tempUploadDir = path.join(os.tmpdir(), 'nas-uploads');
if (!fs.existsSync(tempUploadDir)) {
  fs.mkdirSync(tempUploadDir, { recursive: true });
}

const upload = multer({
  dest: tempUploadDir,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2 GB max file size
  },
});

// Fast in-memory directory cache with TTL
const dirCache = new Map(); // key: `${user}:${cleanPath}` -> { data, timestamp }
const DIR_CACHE_TTL_MS = 20 * 1000; // 20 seconds TTL

function getCachedDir(user, cleanPath) {
  const key = `${user}:${cleanPath}`;
  const entry = dirCache.get(key);
  if (entry && Date.now() - entry.timestamp < DIR_CACHE_TTL_MS) {
    return entry.data;
  }
  return null;
}

function setCachedDir(user, cleanPath, data) {
  const key = `${user}:${cleanPath}`;
  dirCache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

function invalidateDirCache(user, targetPath) {
  if (!targetPath) return;
  const cleanTarget = ftps.normalizePath(targetPath);
  const parent = path.posix.dirname(cleanTarget);
  dirCache.delete(`${user}:${cleanTarget}`);
  dirCache.delete(`${user}:${parent}`);
  dirCache.delete(`${user}:/`);
}

/**
 * GET /api/files/list
 * List directory contents (cached with TTL, bypassed on explicit refresh)
 */
router.get('/list', async (req, res) => {
  try {
    const targetPath = req.query.path || '/';
    const isRefresh = req.query.refresh === 'true' || req.query.refresh === '1';
    const cleanPath = ftps.normalizePath(targetPath);
    const user = req.credentials.user || 'default';

    // If not a forced refresh, check fast in-memory cache
    if (!isRefresh) {
      const cached = getCachedDir(user, cleanPath);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(cached);
      }
    }

    // Fetch fresh listing from FTPS server
    const result = await ftps.listDirectory(req.credentials, cleanPath);
    setCachedDir(user, cleanPath, result);

    res.setHeader('X-Cache', isRefresh ? 'BYPASS' : 'MISS');
    res.json(result);
  } catch (err) {
    console.error('List error:', err);
    res.status(500).json({
      error: 'Nepodařilo se načíst obsah složky.',
      details: err.message,
    });
  }
});

/**
 * GET /api/files/download
 * Download single file
 */
router.get('/download', async (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ error: 'Chybí parametr path.' });
    }

    const filename = path.posix.basename(filePath);
    const contentType = mime.lookup(filename) || 'application/octet-stream';

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Type', contentType);

    await ftps.downloadFile(req.credentials, filePath, res);
  } catch (err) {
    console.error('Download error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Nepodařilo se stáhnout soubor.',
        details: err.message,
      });
    }
  }
});

/**
 * GET /api/files/preview
 * Stream preview (inline image, video, audio, pdf)
 */
router.get('/preview', async (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ error: 'Chybí parametr path.' });
    }

    const filename = path.posix.basename(filePath);
    const contentType = mime.lookup(filename) || 'application/octet-stream';

    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');

    await ftps.downloadFile(req.credentials, filePath, res);
  } catch (err) {
    console.error('Preview error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Nepodařilo se načíst náhled souboru.',
        details: err.message,
      });
    }
  }
});

/**
 * POST /api/files/upload
 * Upload one or more files
 */
router.post('/upload', upload.array('files'), async (req, res) => {
  const files = req.files || [];
  const targetDir = req.query.path || '/';

  if (files.length === 0) {
    return res.status(400).json({ error: 'Nebyly vybrány žádné soubory k nahrání.' });
  }

  const results = [];
  const errors = [];

  for (const file of files) {
    // Safely extract filename handling both Windows and POSIX separators
    const rawName = file.originalname.split(/[\\/]/).pop() || 'upload';
    const cleanName = rawName.replace(/[/\\?%*:|"<>]/g, '').trim();

    if (!cleanName || cleanName === '.' || cleanName === '..') {
      if (file.path && fs.existsSync(file.path)) {
        fs.unlink(file.path, () => {});
      }
      errors.push({ name: file.originalname, error: 'Neplatný název souboru.' });
      continue;
    }

    const cleanTargetDir = ftps.normalizePath(targetDir);
    const destinationPath = cleanTargetDir === '/' ? `/${cleanName}` : `${cleanTargetDir}/${cleanName}`;

    try {
      const readStream = fs.createReadStream(file.path);
      await ftps.uploadFile(req.credentials, readStream, destinationPath);
      results.push({ name: cleanName, path: destinationPath, size: file.size });
    } catch (uploadErr) {
      console.error(`Upload error for ${cleanName}:`, uploadErr);
      errors.push({ name: cleanName, error: uploadErr.message });
    } finally {
      // Clean up temp file
      if (file.path && fs.existsSync(file.path)) {
        fs.unlink(file.path, () => {});
      }
    }
  }

  if (errors.length > 0 && results.length === 0) {
    return res.status(500).json({
      error: 'Nahrávání souborů selhalo.',
      errors,
    });
  }

  invalidateDirCache(req.credentials.user, targetDir);

  res.json({
    success: true,
    uploaded: results,
    errors: errors.length > 0 ? errors : undefined,
  });
});

/**
 * POST /api/files/mkdir
 * Create directory
 */
router.post('/mkdir', async (req, res) => {
  try {
    const { path: parentPath, name } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Zadejte platný název složky.' });
    }

    const cleanName = name.replace(/[/\\?%*:|"<>]/g, '').trim();
    if (!cleanName || cleanName === '.' || cleanName === '..') {
      return res.status(400).json({ error: 'Název složky obsahuje nepovolené znaky.' });
    }

    const cleanParent = ftps.normalizePath(parentPath || '/');
    const targetDir = cleanParent === '/' ? `/${cleanName}` : `${cleanParent}/${cleanName}`;
    await ftps.createDirectory(req.credentials, targetDir);

    invalidateDirCache(req.credentials.user, cleanParent);

    res.json({ success: true, path: targetDir, name: cleanName });
  } catch (err) {
    console.error('Mkdir error:', err);
    res.status(500).json({
      error: 'Nepodařilo se vytvořit složku.',
      details: err.message,
    });
  }
});

/**
 * POST /api/files/rename
 * Rename file or directory
 */
router.post('/rename', async (req, res) => {
  try {
    const { oldPath, newName } = req.body;
    if (!oldPath || !newName || typeof newName !== 'string') {
      return res.status(400).json({ error: 'Chybí parametry oldPath nebo newName.' });
    }

    const cleanNewName = newName.replace(/[/\\?%*:|"<>]/g, '').trim();
    if (!cleanNewName || cleanNewName === '.' || cleanNewName === '..') {
      return res.status(400).json({ error: 'Nový název obsahuje nepovolené znaky.' });
    }

    const cleanOldPath = ftps.normalizePath(oldPath);
    if (cleanOldPath === '/' || cleanOldPath === '') {
      return res.status(400).json({ error: 'Nelze přejmenovat kořenový adresář.' });
    }

    const parentDir = path.posix.dirname(cleanOldPath);
    const newPath = parentDir === '/' ? `/${cleanNewName}` : `${parentDir}/${cleanNewName}`;

    await ftps.renameItem(req.credentials, cleanOldPath, newPath);

    invalidateDirCache(req.credentials.user, cleanOldPath);
    invalidateDirCache(req.credentials.user, newPath);

    res.json({ success: true, oldPath: cleanOldPath, newPath });
  } catch (err) {
    console.error('Rename error:', err);
    res.status(500).json({
      error: 'Přejmenování se nezdařilo.',
      details: err.message,
    });
  }
});

/**
 * DELETE /api/files/delete
 * Delete file or directory
 */
router.delete('/delete', async (req, res) => {
  try {
    const { path: targetPath, isDirectory } = req.body;
    if (!targetPath) {
      return res.status(400).json({ error: 'Chybí parametr path.' });
    }

    const cleanPath = ftps.normalizePath(targetPath);
    if (cleanPath === '/' || cleanPath === '') {
      return res.status(400).json({ error: 'Nelze smazat kořenový adresář.' });
    }

    await ftps.deleteItem(req.credentials, cleanPath, Boolean(isDirectory));

    invalidateDirCache(req.credentials.user, cleanPath);

    res.json({ success: true, path: cleanPath });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({
      error: 'Položku se nepodařilo smazat.',
      details: err.message,
    });
  }
});

/**
 * GET /api/files/read-text
 * Read text file content
 */
router.get('/read-text', async (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ error: 'Chybí parametr path.' });
    }

    const content = await ftps.readTextFile(req.credentials, filePath);
    res.json({ success: true, path: filePath, content });
  } catch (err) {
    console.error('Read text error:', err);
    res.status(500).json({
      error: 'Nepodařilo se načíst obsah souboru.',
      details: err.message,
    });
  }
});

/**
 * PUT /api/files/write-text
 * Write text file content
 */
router.put('/write-text', async (req, res) => {
  try {
    const { path: filePath, content } = req.body;
    if (!filePath || content === undefined) {
      return res.status(400).json({ error: 'Chybí parametry path nebo content.' });
    }

    await ftps.writeTextFile(req.credentials, filePath, content);
    invalidateDirCache(req.credentials.user, filePath);

    res.json({ success: true, path: filePath });
  } catch (err) {
    console.error('Write text error:', err);
    res.status(500).json({
      error: 'Nepodařilo se uložit soubor.',
      details: err.message,
    });
  }
});

module.exports = router;
