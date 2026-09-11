const ftp = require('basic-ftp');
const path = require('path');
const stream = require('stream');
const config = require('./config');

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

/**
 * Creates and connects a basic-ftp client with the given credentials.
 */
async function createClient(credentials) {
  const client = new ftp.Client(30000); // 30 second socket timeout
  // client.ftp.verbose = config.NODE_ENV !== 'production';

  await client.access({
    host: config.FTPS_HOST,
    port: config.FTPS_PORT,
    user: credentials.user || config.FTPS_USER,
    password: credentials.password,
    secure: true,
    secureOptions: {
      rejectUnauthorized: config.FTPS_REJECT_UNAUTHORIZED,
    },
  });

  return client;
}

/**
 * Executes an operation with a managed FTPS client that is always closed on completion,
 * with automatic retry and backoff if the FTPS server connection limit (421) is hit.
 */
async function withClient(credentials, action, retries = 2) {
  let client;
  try {
    client = await createClient(credentials);
    return await action(client);
  } catch (err) {
    const msg = String(err && (err.message || err.code || err));
    const isLimitError = msg.includes('421') || msg.toLowerCase().includes('too many connections') || msg.toLowerCase().includes('connection limit');

    if (client) {
      try { client.close(); } catch (_) {}
      client = null;
    }

    // If hit by server's per-IP connection limit, wait briefly for other requests to finish and retry
    if (retries > 0 && isLimitError) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      return withClient(credentials, action, retries - 1);
    }

    throw err;
  } finally {
    if (client) {
      try { client.close(); } catch (_) {}
    }
  }
}

/**
 * Tests connection and authentication with the given credentials.
 */
async function testConnection(credentials) {
  return withClient(credentials, async (client) => {
    const pwd = await client.pwd();
    return { ok: true, pwd };
  });
}

/**
 * Lists contents of a directory.
 */
async function listDirectory(credentials, targetPath = '/') {
  const cleanPath = normalizePath(targetPath);
  return withClient(credentials, async (client) => {
    const list = await client.list(cleanPath);

    const items = list
      .filter((item) => item.name !== '.' && item.name !== '..')
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
  });
}

/**
 * Downloads a file to a writable stream (e.g. HTTP response).
 */
async function downloadFile(credentials, remotePath, writableStream, startOffset = 0) {
  const cleanPath = normalizePath(remotePath);
  return withClient(credentials, async (client) => {
    await client.downloadTo(writableStream, cleanPath, startOffset);
  });
}

/**
 * Uploads a readable stream to a remote file path.
 */
async function uploadFile(credentials, readableStream, remotePath) {
  const cleanPath = normalizePath(remotePath);
  return withClient(credentials, async (client) => {
    // Ensure parent directory exists
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
  return withClient(credentials, async (client) => {
    await client.ensureDir(cleanPath);
  });
}

/**
 * Renames or moves a file or directory.
 */
async function renameItem(credentials, oldPath, newPath) {
  const cleanOld = normalizePath(oldPath);
  const cleanNew = normalizePath(newPath);
  return withClient(credentials, async (client) => {
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

  return withClient(credentials, async (client) => {
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
async function readTextFile(credentials, remotePath, maxBytes = 5 * 1024 * 1024) {
  const cleanPath = normalizePath(remotePath);
  return withClient(credentials, async (client) => {
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
async function getFileSize(credentials, remotePath) {
  const cleanPath = normalizePath(remotePath);
  return withClient(credentials, async (client) => {
    return await client.size(cleanPath);
  });
}

module.exports = {
  normalizePath,
  testConnection,
  listDirectory,
  downloadFile,
  uploadFile,
  createDirectory,
  renameItem,
  deleteItem,
  readTextFile,
  writeTextFile,
  getFileSize,
};
