const path = require('path');
const stream = require('stream');
const queueManager = require('./queueManager');

// System/recycle entries that should never be listed or traversed
const IGNORED_NAMES = new Set(['.', '..', '#recycle', '@eaDir', '.DS_Store', 'Thumbs.db']);

/**
 * Normalizes a remote path to always be an absolute posix path starting with '/'
 */
function normalizePath(p) {
  if (!p || typeof p !== 'string') return '/';
  const clean = path.posix.normalize(p.trim());
  if (!clean.startsWith('/')) {
    return '/' + clean;
  }
  return clean;
}

function isIgnoredItem(name) {
  return !name || IGNORED_NAMES.has(name);
}

/**
 * Tests connection and authentication with the given credentials.
 * Always performs a fresh FTPS access handshake via the managed queue.
 */
async function testConnection(credentials, meta = {}) {
  return queueManager.enqueueBrowse(
    credentials,
    { ...meta, isAuth: true },
    async (client) => {
      const pwd = await client.pwd();
      return { ok: true, pwd };
    }
  );
}

/**
 * Lists contents of a directory via the managed browse queue.
 */
async function listDirectory(credentials, targetPath = '/', meta = {}) {
  const cleanPath = normalizePath(targetPath);

  if (cleanPath.split('/').some((seg) => seg === '#recycle' || seg === '@eaDir')) {
    const err = new Error('Přístup k systémové složce není povolen.');
    err.code = 550;
    throw err;
  }

  return queueManager.enqueueBrowse(
    credentials,
    { ...meta, path: cleanPath },
    async (client) => {
      const list = await client.list(cleanPath);

      const items = list
        .filter((item) => !isIgnoredItem(item.name))
        .map((item) => {
          const itemPath = cleanPath === '/' ? `/${item.name}` : `${cleanPath}/${item.name}`;
          const isDirectory = item.isDirectory || item.type === 2;
          const ext = isDirectory ? '' : path.extname(item.name).toLowerCase().replace('.', '');

          return {
            name: item.name,
            path: itemPath,
            isDirectory,
            isFile: item.isFile || item.type === 1,
            isSymbolicLink: item.isSymbolicLink || item.type === 3,
            size: item.size || 0,
            modifiedAt: item.modifiedAt ? item.modifiedAt.toISOString() : null,
            permissions: item.permissions || null,
            extension: ext,
          };
        });

      // Sort: directories first, then alphabetical by name
      items.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
      });

      return {
        currentPath: cleanPath,
        items,
      };
    }
  );
}

/**
 * Downloads a file via the user's immune download slot (with live speed/ETA tracking)
 * and cleans up properly if the HTTP client disconnects.
 */
async function downloadFile(credentials, remotePath, res, startOffset = 0, meta = {}) {
  const cleanPath = normalizePath(remotePath);
  const { clientId, fileName, totalBytes = 0, isBatch = false, onBeforeStream = null } = meta;

  return queueManager.withDownloadTransfer(
    clientId,
    credentials,
    {
      fileName: fileName || path.posix.basename(cleanPath),
      totalBytes,
      isBatch,
    },
    async (client, { addChunkBytes, setKnownSize, abortEntry }) => {
      let knownSize = totalBytes;
      if (!knownSize) {
        try {
          knownSize = await client.size(cleanPath);
        } catch (_) {
          knownSize = 0;
        }
      }

      if (knownSize > 0) {
        setKnownSize(knownSize);
      }

      if (onBeforeStream) {
        onBeforeStream(knownSize);
      }

      const passThrough = new stream.PassThrough();
      passThrough.on('error', () => {});
      let clientClosed = false;

      const onHttpClose = () => {
        if (!res.writableFinished) {
          clientClosed = true;
          passThrough.destroy();
          abortEntry();
        }
      };

      res.once('close', onHttpClose);

      passThrough.on('data', (chunk) => {
        addChunkBytes(chunk.length);
      });

      passThrough.pipe(res);

      try {
        await client.downloadTo(passThrough, cleanPath, startOffset);
      } catch (err) {
        if (clientClosed) {
          return;
        }
        passThrough.destroy(err);
        throw err;
      } finally {
        res.off('close', onHttpClose);
      }
    }
  );
}

/**
 * Streams inline file preview (supports HTTP Range requests and clean abort on client close).
 */
async function streamPreview(credentials, remotePath, req, res, contentType, filename, meta = {}) {
  const cleanPath = normalizePath(remotePath);

  return queueManager.enqueueBrowse(
    credentials,
    { ...meta, path: cleanPath },
    async (client) => {
      let fileSize = 0;
      try {
        fileSize = await client.size(cleanPath);
      } catch (_) {
        fileSize = 0;
      }

      const rangeHeader = req.headers.range;
      let startOffset = 0;
      let maxBytesToSend = null;

      if (rangeHeader && fileSize > 0) {
        const match = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader);
        if (match) {
          startOffset = parseInt(match[1], 10);
          const requestedEnd = match[2] ? parseInt(match[2], 10) : null;
          // Cap open-ended video/audio chunk requests to 2 MB so seeking & slot sharing stay responsive
          const maxChunk = 2 * 1024 * 1024;
          const endOffset =
            requestedEnd !== null
              ? Math.min(requestedEnd, fileSize - 1)
              : Math.min(startOffset + maxChunk - 1, fileSize - 1);

          if (startOffset >= fileSize || startOffset > endOffset) {
            res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
            res.end();
            return;
          }

          maxBytesToSend = endOffset - startOffset + 1;
          res.status(206);
          res.setHeader('Content-Range', `bytes ${startOffset}-${endOffset}/${fileSize}`);
          res.setHeader('Content-Length', maxBytesToSend);
        }
      } else if (fileSize > 0) {
        res.setHeader('Content-Length', fileSize);
      }

      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');

      const passThrough = new stream.PassThrough();
      passThrough.on('error', () => {});
      let sentBytes = 0;
      let stoppedEarly = false;

      const stopStream = () => {
        if (!stoppedEarly) {
          stoppedEarly = true;
          passThrough.end();
          try {
            client.close();
          } catch (_) {}
        }
      };

      const onHttpClose = () => {
        if (!res.writableFinished) {
          stoppedEarly = true;
          passThrough.destroy();
          try {
            client.close();
          } catch (_) {}
        }
      };

      res.once('close', onHttpClose);

      // Intercept chunks when enforcing a capped 206 Range window
      const sink = new stream.Writable({
        write(chunk, encoding, callback) {
          if (stoppedEarly) {
            callback();
            return;
          }
          if (maxBytesToSend !== null) {
            const remaining = maxBytesToSend - sentBytes;
            if (remaining <= 0) {
              stopStream();
              callback();
              return;
            }
            const slice = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
            sentBytes += slice.length;
            const canContinue = passThrough.write(slice);
            if (sentBytes >= maxBytesToSend) {
              stopStream();
            }
            if (!canContinue) {
              passThrough.once('drain', callback);
            } else {
              callback();
            }
          } else {
            sentBytes += chunk.length;
            const canContinue = passThrough.write(chunk);
            if (!canContinue) {
              passThrough.once('drain', callback);
            } else {
              callback();
            }
          }
        },
        final(callback) {
          if (!stoppedEarly) {
            passThrough.end();
          }
          callback();
        },
      });
      sink.on('error', () => {});

      passThrough.pipe(res);

      try {
        await client.downloadTo(sink, cleanPath, startOffset);
      } catch (err) {
        if (stoppedEarly) {
          return;
        }
        passThrough.destroy(err);
        throw err;
      } finally {
        res.off('close', onHttpClose);
      }
    }
  );
}

/**
 * Uploads a readable stream to a remote file path.
 */
async function uploadFile(credentials, readableStream, remotePath) {
  const cleanPath = normalizePath(remotePath);
  return queueManager.enqueueBrowse(credentials, { path: cleanPath }, async (client) => {
    const parentDir = path.posix.dirname(cleanPath);
    if (parentDir && parentDir !== '/') {
      await client.ensureDir(parentDir);
    }
    await client.uploadFrom(readableStream, cleanPath);
  });
}

/**
 * Creates a directory.
 */
async function createDirectory(credentials, remotePath) {
  const cleanPath = normalizePath(remotePath);
  return queueManager.enqueueBrowse(credentials, { path: cleanPath }, async (client) => {
    await client.ensureDir(cleanPath);
  });
}

/**
 * Renames or moves a file or directory.
 */
async function renameItem(credentials, oldPath, newPath) {
  const cleanOld = normalizePath(oldPath);
  const cleanNew = normalizePath(newPath);
  return queueManager.enqueueBrowse(credentials, { path: cleanOld }, async (client) => {
    await client.rename(cleanOld, cleanNew);
  });
}

/**
 * Deletes a file or directory.
 */
async function deleteItem(credentials, remotePath, isDirectory = false) {
  const cleanPath = normalizePath(remotePath);
  if (cleanPath === '/' || cleanPath === '') {
    throw new Error('Nelze smazat kořenový adresář.');
  }

  return queueManager.enqueueBrowse(credentials, { path: cleanPath }, async (client) => {
    if (isDirectory) {
      await client.removeDir(cleanPath);
    } else {
      await client.remove(cleanPath);
    }
  });
}

/**
 * Reads text file content into memory.
 */
async function readTextFile(credentials, remotePath, maxBytes = 5 * 1024 * 1024, meta = {}) {
  const cleanPath = normalizePath(remotePath);
  return queueManager.enqueueBrowse(credentials, { ...meta, path: cleanPath }, async (client) => {
    const chunks = [];
    let totalLength = 0;

    const memoryStream = new stream.Writable({
      write(chunk, encoding, callback) {
        totalLength += chunk.length;
        if (totalLength > maxBytes) {
          callback(new Error('Soubor je příliš velký pro textový editor (max 5 MB).'));
          return;
        }
        chunks.push(chunk);
        callback();
      },
    });

    await client.downloadTo(memoryStream, cleanPath);
    const buffer = Buffer.concat(chunks);
    return buffer.toString('utf8');
  });
}

/**
 * Writes text content to a remote file.
 */
async function writeTextFile(credentials, remotePath, content) {
  const cleanPath = normalizePath(remotePath);
  const bufferStream = stream.Readable.from(Buffer.from(content, 'utf8'));
  return uploadFile(credentials, bufferStream, cleanPath);
}

/**
 * Gets file size in bytes.
 */
async function getFileSize(credentials, remotePath, meta = {}) {
  const cleanPath = normalizePath(remotePath);
  return queueManager.enqueueBrowse(credentials, { ...meta, path: cleanPath }, async (client) => {
    return await client.size(cleanPath);
  });
}

/**
 * Recursively scans a directory tree and returns a list of all files with their relative paths and sizes.
 * Runs inside the user's download slot when invoked as part of a ZIP folder download.
 */
async function getDirectoryTree(credentials, targetPath = '/', meta = {}) {
  const rootPath = normalizePath(targetPath);

  const scanWithClient = async (client) => {
    const files = [];
    const queue = [rootPath];

    while (queue.length > 0) {
      const currentDir = queue.shift();
      let list;
      try {
        list = await client.list(currentDir);
      } catch (err) {
        // Gracefully skip restricted/system subfolders (550) instead of failing the whole ZIP
        if (err && err.code === 550 && currentDir !== rootPath) {
          continue;
        }
        throw err;
      }

      for (const item of list) {
        if (isIgnoredItem(item.name)) continue;
        const fullItemPath = currentDir === '/' ? `/${item.name}` : `${currentDir}/${item.name}`;
        const isDirectory = item.isDirectory || item.type === 2;

        if (isDirectory) {
          queue.push(fullItemPath);
        } else {
          let rel = path.posix.relative(rootPath, fullItemPath);
          if (rel.startsWith('/')) {
            rel = rel.slice(1);
          }
          files.push({
            name: item.name,
            path: fullItemPath,
            relativePath: rel || item.name,
            size: item.size || 0,
            modifiedAt: item.modifiedAt ? item.modifiedAt.toISOString() : null,
          });
        }
      }
    }

    const totalSize = files.reduce((acc, f) => acc + (f.size || 0), 0);
    const folderName = path.posix.basename(rootPath) || 'root';

    return {
      root: rootPath,
      folderName,
      totalFiles: files.length,
      totalSize,
      files,
    };
  };

  if (meta.isDownload && meta.clientId) {
    const tree = await queueManager.withDownloadTransfer(
      meta.clientId,
      credentials,
      { fileName: `${path.posix.basename(rootPath) || 'slozka'}.zip`, isBatch: true },
      scanWithClient
    );
    queueManager.updateLeaseBatchInfo(meta.clientId, {
      totalBytes: tree.totalSize,
      fileName: `${tree.folderName}.zip`,
    });
    return tree;
  }

  return queueManager.enqueueBrowse(credentials, { ...meta, path: rootPath }, scanWithClient);
}

module.exports = {
  normalizePath,
  testConnection,
  listDirectory,
  downloadFile,
  streamPreview,
  uploadFile,
  createDirectory,
  renameItem,
  deleteItem,
  readTextFile,
  writeTextFile,
  getFileSize,
  getDirectoryTree,
};
