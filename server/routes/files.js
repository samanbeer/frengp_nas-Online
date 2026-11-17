const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const os = require('os');
const multer = require('multer');
const mime = require('mime-types');
const authMiddleware = require('../middleware/authMiddleware');
const ftps = require('../ftps');
const priorityStore = require('../priorityStore');

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

// Fast in-memory directory cache with TTL (shared per NAS account)
const dirCache = new Map(); // key: `${user}:${cleanPath}` -> { data, timestamp }
const inflightListings = new Map(); // key: `${user}:${cleanPath}` -> Promise
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
 * List directory contents (shared cache with TTL, bypassed on explicit refresh)
 */
router.get('/list', async (req, res) => {
  try {
    const clientId = priorityStore.getOrCreateQueueClientId(req, res);
    const targetPath = req.query.path || '/';
    const isRefresh = req.query.refresh === 'true' || req.query.refresh === '1';
    const isPrefetch = req.query.prefetch === '1';
    const browseId = typeof req.query.browseId === 'string' ? req.query.browseId : '';
    const cleanPath = ftps.normalizePath(targetPath);
    const user = req.credentials.user || 'default';
    const cacheKey = `${user}:${cleanPath}`;

    // If not a forced refresh, check fast shared in-memory cache
    if (!isRefresh) {
      const cached = getCachedDir(user, cleanPath);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(cached);
      }

      // Coalesce identical concurrent non-refresh directory listings
      if (inflightListings.has(cacheKey)) {
        const result = await inflightListings.get(cacheKey);
        if (result && result.skipped) {
          return res.json({ skipped: true, currentPath: cleanPath, items: null });
        }
        res.setHeader('X-Cache', 'COALESCED');
        return res.json(result);
      }
    }

    // Fetch fresh listing from FTPS server via browse queue
    const listingPromise = ftps.listDirectory(req.credentials, cleanPath, {
      clientId,
      browseId,
      isPrefetch,
    });

    if (!isRefresh && !isPrefetch) {
      inflightListings.set(cacheKey, listingPromise);
    }

    let result;
    try {
      result = await listingPromise;
    } finally {
      if (inflightListings.get(cacheKey) === listingPromise) {
        inflightListings.delete(cacheKey);
      }
    }

    if (result && result.skipped) {
      return res.json({ skipped: true, currentPath: cleanPath, items: null });
    }

    setCachedDir(user, cleanPath, result);

    res.setHeader('X-Cache', isRefresh ? 'BYPASS' : 'MISS');
    res.json(result);
  } catch (err) {
    console.error('List error:', err);
    res.status(err.code === 550 ? 404 : 500).json({
      error: 'Nepodařilo se načíst obsah složky.',
      details: err.message,
    });
  }
});


/**
 * GET /api/files/tree
 * Recursively list all files in a directory tree for zip download
 */
router.get('/tree', async (req, res) => {
  try {
    const clientId = priorityStore.getOrCreateQueueClientId(req, res);
    const targetPath = req.query.path;
    if (!targetPath) {
      return res.status(400).json({ error: 'Chybí parametr path.' });
    }

    const cleanPath = ftps.normalizePath(targetPath);
    const isDownload = req.query.download === '1';
    const result = await ftps.getDirectoryTree(req.credentials, cleanPath, {
      clientId,
      isDownload,
    });
    res.json(result);
  } catch (err) {
    console.error('Tree error:', err);
    res.status(err.code === 'QUEUE_FULL' ? 429 : 500).json({
      error: 'Nepodařilo se prohledat složku.',
      details: err.message,
    });
  }
});

/**
 * GET /api/files/download
 * Download single file via immune download slot
 */
router.get('/download', async (req, res) => {
  try {
    const clientId = priorityStore.getOrCreateQueueClientId(req, res);
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ error: 'Chybí parametr path.' });
    }

    const filename = path.posix.basename(filePath);
    const contentType = mime.lookup(filename) || 'application/octet-stream';
    const totalBytes = parseInt(req.query.size, 10) || 0;
    const isBatch = req.query.batch === '1';

    await ftps.downloadFile(req.credentials, filePath, res, 0, {
      clientId,
      fileName: filename,
      totalBytes,
      isBatch,
      onBeforeStream: (knownSize) => {
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
        res.setHeader('Content-Type', contentType);
        if (knownSize > 0) {
          res.setHeader('Content-Length', knownSize);
        }
      },
    });
  } catch (err) {
    console.error('Download error:', err);
    if (!res.headersSent) {
      const status = err.code === 'QUEUE_FULL' ? 429 : 500;
      res.status(status).json({
        error: err.code === 'QUEUE_FULL'
          ? 'Všechny sloty pro stahování jsou obsazené. Použijte frontu v rozhraní.'
          : 'Nepodařilo se stáhnout soubor.',
        code: err.code,
        details: err.message,
      });
    } else {
      res.destroy();
    }
  }
});

/**
 * GET /api/files/preview
 * Stream preview (inline image, video, audio, pdf with HTTP Range support)
 */
router.get('/preview', async (req, res) => {
  try {
    const clientId = priorityStore.getOrCreateQueueClientId(req, res);
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ error: 'Chybí parametr path.' });
    }

    const filename = path.posix.basename(filePath);
    const contentType = mime.lookup(filename) || 'application/octet-stream';

    await ftps.streamPreview(req.credentials, filePath, req, res, contentType, filename, {
      clientId,
    });
  } catch (err) {
    console.error('Preview error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Nepodařilo se načíst náhled souboru.',
        details: err.message,
      });
    } else {
      res.destroy();
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
    const clientId = priorityStore.getOrCreateQueueClientId(req, res);
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ error: 'Chybí parametr path.' });
    }

    const content = await ftps.readTextFile(req.credentials, filePath, 5 * 1024 * 1024, {
      clientId,
    });
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
