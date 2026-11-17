const crypto = require('crypto');
const ftp = require('basic-ftp');
const config = require('./config');

const MAX_TOTAL = config.FTPS_MAX_CONNECTIONS; // 5
const MAX_DOWNLOAD_SLOTS = Math.min(config.FTPS_MAX_DOWNLOAD_SLOTS, Math.max(1, MAX_TOTAL - 1)); // 4 (leaves >=1 for browse)
const DOWNLOAD_GRACE_MS = config.FTPS_DOWNLOAD_GRACE_MS; // 7000 ms
const HANDSHAKE_TIMEOUT_MS = 15000; // 15s for browser to initiate HTTP transfer after slot grant
const BROWSE_IDLE_MS = config.FTPS_BROWSE_IDLE_MS; // 20000 ms
const MAX_CLIENT_REUSES = 40; // Recycle physical client periodically to avoid EventEmitter/socket buildup
const DISCONNECT_CLEANUP_MS = 4000; // Grace window if SSE drops during page reload

// ============================================================================
// Physical FTPS Connection Pool (strict global cap <= MAX_TOTAL = 5)
// ============================================================================

const physicalPool = []; // Array<{ id, client, credHash, user, busy, lastUsed, useCount }>
const physicalWaiters = []; // Array<{ resolve, reject, priority }>
let creatingCount = 0;

function hashCredentials(credentials) {
  const user = credentials.user || config.FTPS_USER || '';
  const pass = credentials.password || '';
  return crypto
    .createHmac('sha256', config.SESSION_SECRET)
    .update(`${user}\0${pass}`)
    .digest('hex');
}

function getTotalPhysicalCount() {
  // Prune any externally closed clients first
  for (let i = physicalPool.length - 1; i >= 0; i--) {
    if (!physicalPool[i].client || physicalPool[i].client.closed) {
      physicalPool.splice(i, 1);
    }
  }
  return physicalPool.length + creatingCount;
}

async function openNewPhysicalClient(credentials) {
  const client = new ftp.Client(30000);
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

function closeEntrySafely(entry) {
  const idx = physicalPool.indexOf(entry);
  if (idx !== -1) physicalPool.splice(idx, 1);
  if (entry && entry.client) {
    try {
      entry.client.close();
    } catch (_) {}
  }
}

/**
 * Acquires an exclusive physical FTPS client within the global 5-connection ceiling.
 * If forceFresh is true (used for password verification on /login), always performs
 * a fresh FTPS access handshake without reusing an existing pooled session.
 */
async function acquirePhysicalClient(credentials, { forceFresh = false, highPriority = false } = {}) {
  const credHash = hashCredentials(credentials);

  while (true) {
    // Clean up closed entries
    getTotalPhysicalCount();

    // 1. Reuse matching idle client unless forceFresh is requested
    if (!forceFresh) {
      for (let i = physicalPool.length - 1; i >= 0; i--) {
        const entry = physicalPool[i];
        if (!entry.busy && entry.credHash === credHash && entry.useCount < MAX_CLIENT_REUSES) {
          entry.busy = true;
          const idleAge = Date.now() - entry.lastUsed;
          if (idleAge > 4000) {
            try {
              await entry.client.send('NOOP');
              entry.useCount++;
              entry.lastUsed = Date.now();
              return entry;
            } catch (_) {
              closeEntrySafely(entry);
              continue;
            }
          } else {
            entry.useCount++;
            entry.lastUsed = Date.now();
            return entry;
          }
        }
      }
    }

    // 2. If pool is at max total capacity, evict an idle client first
    if (getTotalPhysicalCount() >= MAX_TOTAL) {
      let oldestIdleIdx = -1;
      let oldestTime = Infinity;
      for (let i = 0; i < physicalPool.length; i++) {
        if (!physicalPool[i].busy && physicalPool[i].lastUsed < oldestTime) {
          oldestTime = physicalPool[i].lastUsed;
          oldestIdleIdx = i;
        }
      }
      if (oldestIdleIdx !== -1) {
        closeEntrySafely(physicalPool[oldestIdleIdx]);
      }
    }

    // 3. If a physical slot is free, create a new client
    if (getTotalPhysicalCount() < MAX_TOTAL) {
      creatingCount++;
      try {
        const client = await openNewPhysicalClient(credentials);
        const entry = {
          id: crypto.randomBytes(6).toString('hex'),
          client,
          credHash,
          user: credentials.user || config.FTPS_USER,
          busy: true,
          lastUsed: Date.now(),
          useCount: 1,
        };
        physicalPool.push(entry);
        return entry;
      } finally {
        creatingCount--;
        notifyPhysicalWaiter();
      }
    }

    // 4. All 5 physical connections are currently busy; wait for one to free up
    await new Promise((resolve, reject) => {
      const waiter = { resolve, reject, priority: highPriority };
      if (highPriority) {
        physicalWaiters.unshift(waiter);
      } else {
        physicalWaiters.push(waiter);
      }
    });
  }
}

function notifyPhysicalWaiter() {
  if (physicalWaiters.length > 0 && getTotalPhysicalCount() < MAX_TOTAL) {
    const waiter = physicalWaiters.shift();
    if (waiter) waiter.resolve();
  } else if (physicalWaiters.length > 0 && physicalPool.some((e) => !e.busy)) {
    const waiter = physicalWaiters.shift();
    if (waiter) waiter.resolve();
  }
}

function releasePhysicalClient(entry, { broken = false } = {}) {
  if (!entry) return;
  if (broken || !entry.client || entry.client.closed || entry.useCount >= MAX_CLIENT_REUSES) {
    closeEntrySafely(entry);
  } else {
    entry.busy = false;
    entry.lastUsed = Date.now();
  }
  notifyPhysicalWaiter();
  drainQueues();
}

// Background idle connection cleaner (20s TTL)
const idleCleaner = setInterval(() => {
  const now = Date.now();
  let freed = false;
  for (let i = physicalPool.length - 1; i >= 0; i--) {
    const entry = physicalPool[i];
    if (!entry.busy && (entry.client.closed || now - entry.lastUsed >= BROWSE_IDLE_MS)) {
      closeEntrySafely(entry);
      freed = true;
    }
  }
  if (freed) {
    notifyPhysicalWaiter();
  }
}, 2000);
if (idleCleaner.unref) idleCleaner.unref();

// ============================================================================
// Dynamic 5/0 <-> 4/1 Scheduler, Browse Queue & Interactive Download Queue
// ============================================================================

const activeDownloadLeases = new Map(); // clientId -> Lease
const downloadQueue = []; // Array<Ticket>
const browseQueue = []; // Array<BrowseTask>
const activeBrowseTasks = new Map(); // browseId -> { browseId, clientId, path, isAuth }
const sseClients = new Map(); // clientId -> Set<res>
const disconnectTimers = new Map(); // clientId -> Timeout
const clientAnonLabels = new Map(); // clientId -> number (stable "Žák #N" in current session)
let anonCounter = 1;
let lastBroadcastAt = 0;
let pendingBroadcastTimer = null;

function getAnonNumber(clientId) {
  let num = clientAnonLabels.get(clientId);
  if (!num) {
    num = anonCounter++;
    if (anonCounter > 999) anonCounter = 1;
    clientAnonLabels.set(clientId, num);
  }
  return num;
}

function isDownloadModeActive() {
  return activeDownloadLeases.size > 0 || downloadQueue.length > 0;
}

function getCurrentMaxBrowseSlots() {
  if (isDownloadModeActive()) {
    return Math.max(1, MAX_TOTAL - MAX_DOWNLOAD_SLOTS); // 1 when 4/1
  }
  return MAX_TOTAL; // 5 when idle (5/0)
}

function isPermanentFtpError(err) {
  if (!err) return false;
  const code = err.code;
  if (code === 530 || code === 550 || code === 553 || code === 501 || code === 502) {
    return true;
  }
  const msg = String(err.message || err);
  return (
    msg.includes('530 ') ||
    msg.includes('550 ') ||
    msg.includes('ERR_ABORTED') ||
    msg.includes('aborted')
  );
}

function isLimitError(err) {
  if (!err) return false;
  const msg = String(err.message || err.code || err).toLowerCase();
  return msg.includes('421') || msg.includes('too many connections') || msg.includes('connection limit');
}

// ============================================================================
// Queue State Serialization & SSE Broadcasting
// ============================================================================

function buildStateSnapshotFor(viewerClientId) {
  const now = Date.now();
  const mode = isDownloadModeActive() ? `${MAX_DOWNLOAD_SLOTS}/${getCurrentMaxBrowseSlots()}` : `${MAX_TOTAL}/0`;

  const active = Array.from(activeDownloadLeases.values()).map((lease, idx) => {
    const isYou = lease.clientId === viewerClientId;
    const graceRemainingSeconds =
      lease.status === 'grace' && lease.graceEndsAt
        ? Math.max(0, Math.ceil((lease.graceEndsAt - now) / 1000))
        : null;

    const percent =
      lease.status === 'grace'
        ? 100
        : lease.totalBytes > 0
        ? Math.min(99, Math.max(0, Math.round((lease.transferredBytes / lease.totalBytes) * 100)))
        : null;

    return {
      slot: idx + 1,
      isYou,
      label: isYou ? 'Ty' : `Žák #${getAnonNumber(lease.clientId)}`,
      type: lease.type,
      status: lease.status, // 'granted' | 'downloading' | 'grace'
      hasPriority: Boolean(lease.hasPriority),
      percent,
      etaSeconds: lease.etaSeconds,
      graceRemainingSeconds,
      graceEndsAt: lease.graceEndsAt,
    };
  });

  const waiting = downloadQueue.map((ticket, idx) => {
    const isYou = ticket.clientId === viewerClientId;
    return {
      ticketId: ticket.id,
      position: idx + 1,
      isYou,
      label: isYou ? 'Ty' : `Žák #${getAnonNumber(ticket.clientId)}`,
      type: ticket.type,
      hasPriority: Boolean(ticket.hasPriority),
    };
  });

  const browseItems = [];
  for (const task of activeBrowseTasks.values()) {
    browseItems.push({
      browseId: task.browseId,
      isYou: task.clientId === viewerClientId,
      status: 'active',
      aheadCount: 0,
    });
  }
  browseQueue.forEach((task, idx) => {
    browseItems.push({
      browseId: task.browseId,
      isYou: task.clientId === viewerClientId,
      status: 'queued',
      aheadCount: activeBrowseTasks.size + idx,
    });
  });

  const yourActiveSlot = active.find((a) => a.isYou) || null;
  const yourWaitingTicket = waiting.find((w) => w.isYou) || null;

  return {
    mode,
    slots: {
      total: MAX_TOTAL,
      maxDownloads: MAX_DOWNLOAD_SLOTS,
      activeDownloads: active.length,
      maxBrowse: getCurrentMaxBrowseSlots(),
      activeBrowse: activeBrowseTasks.size,
      waitingBrowse: browseQueue.length,
    },
    active,
    waiting,
    browse: {
      activeCount: activeBrowseTasks.size,
      waitingCount: browseQueue.length,
      items: browseItems,
    },
    yourActiveSlot,
    yourWaitingTicket,
    serverTime: now,
  };
}

function sendSseToAll() {
  lastBroadcastAt = Date.now();
  for (const [clientId, resSet] of sseClients.entries()) {
    const payload = `data: ${JSON.stringify(buildStateSnapshotFor(clientId))}\n\n`;
    for (const res of resSet) {
      try {
        res.write(payload);
      } catch (_) {}
    }
  }
}

function broadcastQueueState({ immediate = false } = {}) {
  if (sseClients.size === 0) return;

  const now = Date.now();
  const elapsed = now - lastBroadcastAt;

  if (immediate || elapsed >= 250) {
    if (pendingBroadcastTimer) {
      clearTimeout(pendingBroadcastTimer);
      pendingBroadcastTimer = null;
    }
    sendSseToAll();
  } else if (!pendingBroadcastTimer) {
    pendingBroadcastTimer = setTimeout(() => {
      pendingBroadcastTimer = null;
      sendSseToAll();
    }, 250 - elapsed);
  }
}

function addSseClient(clientId, res) {
  if (disconnectTimers.has(clientId)) {
    clearTimeout(disconnectTimers.get(clientId));
    disconnectTimers.delete(clientId);
  }

  let set = sseClients.get(clientId);
  if (!set) {
    set = new Set();
    sseClients.set(clientId, set);
  }
  set.add(res);

  // Send initial snapshot right away
  try {
    res.write(`data: ${JSON.stringify(buildStateSnapshotFor(clientId))}\n\n`);
  } catch (_) {}

  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch (_) {}
  }, 20000);
  if (heartbeat.unref) heartbeat.unref();

  return () => {
    clearInterval(heartbeat);
    const currentSet = sseClients.get(clientId);
    if (currentSet) {
      currentSet.delete(res);
      if (currentSet.size === 0) {
        sseClients.delete(clientId);
        scheduleDisconnectCleanup(clientId);
      }
    }
  };
}

function scheduleDisconnectCleanup(clientId) {
  if (disconnectTimers.has(clientId)) {
    clearTimeout(disconnectTimers.get(clientId));
  }
  const timer = setTimeout(() => {
    disconnectTimers.delete(clientId);
    // Only clean up waiting tickets if user didn't reconnect
    if (!sseClients.has(clientId)) {
      const waitIdx = downloadQueue.findIndex((t) => t.clientId === clientId);
      if (waitIdx !== -1) {
        const [removed] = downloadQueue.splice(waitIdx, 1);
        if (removed && removed.rejectSlot) {
          removed.rejectSlot(new Error('Spojení s prohlížečem bylo přerušeno.'));
        }
        broadcastQueueState({ immediate: true });
        drainQueues();
      }
    }
  }, DISCONNECT_CLEANUP_MS);
  if (timer.unref) timer.unref();
  disconnectTimers.set(clientId, timer);
}

// ============================================================================
// Browse Queue Execution
// ============================================================================

function enqueueBrowse(credentials, meta, actionFn) {
  const { clientId = 'anon', browseId = '', path = '', isPrefetch = false, isAuth = false } = meta || {};
  const maxBrowse = getCurrentMaxBrowseSlots();

  // Never let hover prefetches wait in queue or steal slots when busy
  if (isPrefetch && (activeBrowseTasks.size >= maxBrowse || browseQueue.length > 0)) {
    return Promise.resolve({ skipped: true });
  }

  return new Promise((resolve, reject) => {
    const task = {
      id: browseId || crypto.randomBytes(6).toString('hex'),
      clientId,
      browseId: browseId || '',
      path,
      isAuth,
      credentials,
      actionFn,
      resolve,
      reject,
      retriesLeft: isAuth ? 0 : 1,
    };

    if (isAuth) {
      browseQueue.unshift(task);
    } else {
      browseQueue.push(task);
    }

    broadcastQueueState({ immediate: true });
    drainQueues();
  });
}

async function runBrowseTask(task) {
  activeBrowseTasks.set(task.id, {
    browseId: task.browseId || task.id,
    clientId: task.clientId,
    path: task.path,
    isAuth: task.isAuth,
  });
  broadcastQueueState({ immediate: true });

  let entry = null;
  let broken = false;
  try {
    entry = await acquirePhysicalClient(task.credentials, {
      forceFresh: Boolean(task.isAuth),
      highPriority: Boolean(task.isAuth),
    });
    const result = await task.actionFn(entry.client);
    task.resolve(result);
  } catch (err) {
    broken = true;
    if (task.retriesLeft > 0 && !isPermanentFtpError(err) && isLimitError(err)) {
      task.retriesLeft--;
      releasePhysicalClient(entry, { broken: true });
      entry = null;
      activeBrowseTasks.delete(task.id);
      setTimeout(() => {
        browseQueue.unshift(task);
        drainQueues();
      }, 600);
      return;
    }
    task.reject(err);
  } finally {
    if (entry) {
      releasePhysicalClient(entry, { broken });
    }
    activeBrowseTasks.delete(task.id);
    broadcastQueueState();
    drainQueues();
  }
}

// ============================================================================
// Download Slot Leases & Waiting Queue
// ============================================================================

function clearLeaseTimers(lease) {
  if (lease.graceTimer) {
    clearTimeout(lease.graceTimer);
    lease.graceTimer = null;
  }
  if (lease.handshakeTimer) {
    clearTimeout(lease.handshakeTimer);
    lease.handshakeTimer = null;
  }
}

function createDownloadLease({ clientId, fingerprintKey, fileName, totalBytes, type, hasPriority = false }) {
  const lease = {
    clientId,
    fingerprintKey,
    fileName: fileName || 'Soubor',
    type: type || 'file',
    totalBytes: totalBytes || 0,
    transferredBytes: 0,
    speedBps: 0,
    etaSeconds: null,
    status: 'granted', // 'granted' | 'downloading' | 'grace'
    hasPriority,
    activeTransfers: 0,
    graceEndsAt: Date.now() + HANDSHAKE_TIMEOUT_MS,
    graceTimer: null,
    handshakeTimer: null,
    abortCallbacks: new Set(),
    canceled: false,
  };

  lease.handshakeTimer = setTimeout(() => {
    if (lease.activeTransfers === 0 && lease.status === 'granted') {
      releaseDownloadLease(clientId, 'handshake_timeout');
    }
  }, HANDSHAKE_TIMEOUT_MS);
  if (lease.handshakeTimer.unref) lease.handshakeTimer.unref();

  activeDownloadLeases.set(clientId, lease);
  return lease;
}

function releaseDownloadLease(clientId, reason = 'released') {
  const lease = activeDownloadLeases.get(clientId);
  if (!lease) return;

  clearLeaseTimers(lease);

  if (reason === 'canceled') {
    lease.canceled = true;
    for (const abortFn of lease.abortCallbacks) {
      try {
        abortFn();
      } catch (_) {}
    }
    lease.abortCallbacks.clear();
  }

  activeDownloadLeases.delete(clientId);
  promoteNextFromDownloadQueue();
  broadcastQueueState({ immediate: true });
  drainQueues();
}

function startDownloadGraceTimer(lease) {
  clearLeaseTimers(lease);
  lease.status = 'grace';
  lease.speedBps = 0;
  lease.etaSeconds = null;
  lease.graceEndsAt = Date.now() + DOWNLOAD_GRACE_MS;

  lease.graceTimer = setTimeout(() => {
    if (lease.activeTransfers === 0) {
      releaseDownloadLease(lease.clientId, 'grace_expired');
    }
  }, DOWNLOAD_GRACE_MS);
  if (lease.graceTimer.unref) lease.graceTimer.unref();

  broadcastQueueState({ immediate: true });
}

function promoteNextFromDownloadQueue() {
  while (activeDownloadLeases.size < MAX_DOWNLOAD_SLOTS && downloadQueue.length > 0) {
    const ticket = downloadQueue.shift();
    if (!ticket) break;

    // If somehow this clientId already got a lease, resolve and continue
    let lease = activeDownloadLeases.get(ticket.clientId);
    if (!lease) {
      lease = createDownloadLease({
        clientId: ticket.clientId,
        fingerprintKey: ticket.fingerprintKey,
        fileName: ticket.fileName,
        totalBytes: ticket.totalBytes,
        type: ticket.type,
        hasPriority: ticket.hasPriority,
      });
    }
    if (ticket.resolveSlot) {
      ticket.resolveSlot({ status: 'active' });
    }
  }
}

function sortDownloadQueue() {
  downloadQueue.sort((a, b) => {
    if (a.hasPriority && !b.hasPriority) return -1;
    if (!a.hasPriority && b.hasPriority) return 1;
    if (a.hasPriority && b.hasPriority) {
      return (a.priorityAt || 0) - (b.priorityAt || 0);
    }
    return a.joinedAt - b.joinedAt;
  });
}

function requestDownloadSlot({ clientId, fingerprintKey, fileName, totalBytes, type }) {
  // 1. User already holds an active download lease (e.g. during 7s grace or sequential ZIP)
  const existingLease = activeDownloadLeases.get(clientId);
  if (existingLease) {
    clearLeaseTimers(existingLease);
    existingLease.canceled = false;
    existingLease.fileName = fileName || existingLease.fileName;
    existingLease.type = type || existingLease.type;
    existingLease.totalBytes = totalBytes || 0;
    existingLease.transferredBytes = 0;
    existingLease.speedBps = 0;
    existingLease.etaSeconds = null;
    if (existingLease.activeTransfers === 0) {
      existingLease.status = 'granted';
      existingLease.graceEndsAt = Date.now() + HANDSHAKE_TIMEOUT_MS;
      existingLease.handshakeTimer = setTimeout(() => {
        if (existingLease.activeTransfers === 0 && existingLease.status === 'granted') {
          releaseDownloadLease(clientId, 'handshake_timeout');
        }
      }, HANDSHAKE_TIMEOUT_MS);
      if (existingLease.handshakeTimer.unref) existingLease.handshakeTimer.unref();
    }
    broadcastQueueState({ immediate: true });
    return { status: 'active', promise: Promise.resolve({ status: 'active' }) };
  }

  // 2. User already waiting in download queue
  const existingTicketIdx = downloadQueue.findIndex((t) => t.clientId === clientId);
  if (existingTicketIdx !== -1) {
    const ticket = downloadQueue[existingTicketIdx];
    ticket.fileName = fileName || ticket.fileName;
    ticket.totalBytes = totalBytes || ticket.totalBytes;
    ticket.type = type || ticket.type;
    broadcastQueueState({ immediate: true });
    return {
      status: 'queued',
      position: existingTicketIdx + 1,
      ticketId: ticket.id,
      promise: ticket.waitPromise,
    };
  }

  // 3. Free download slot available immediately
  if (activeDownloadLeases.size < MAX_DOWNLOAD_SLOTS) {
    createDownloadLease({ clientId, fingerprintKey, fileName, totalBytes, type });
    broadcastQueueState({ immediate: true });
    drainQueues();
    return { status: 'active', promise: Promise.resolve({ status: 'active' }) };
  }

  // 4. All 4 download slots busy -> enqueue user
  let resolveSlot;
  let rejectSlot;
  const waitPromise = new Promise((res, rej) => {
    resolveSlot = res;
    rejectSlot = rej;
  });

  const ticket = {
    id: crypto.randomBytes(6).toString('hex'),
    clientId,
    fingerprintKey,
    fileName: fileName || 'Soubor',
    totalBytes: totalBytes || 0,
    type: type || 'file',
    hasPriority: false,
    priorityAt: null,
    joinedAt: Date.now(),
    waitPromise,
    resolveSlot,
    rejectSlot,
  };

  downloadQueue.push(ticket);
  broadcastQueueState({ immediate: true });
  drainQueues();

  const pos = downloadQueue.findIndex((t) => t.id === ticket.id) + 1;
  return {
    status: 'queued',
    position: pos,
    ticketId: ticket.id,
    promise: waitPromise,
  };
}

function cancelDownloadSlot(clientId) {
  let removed = false;

  const waitIdx = downloadQueue.findIndex((t) => t.clientId === clientId);
  if (waitIdx !== -1) {
    const [ticket] = downloadQueue.splice(waitIdx, 1);
    if (ticket && ticket.rejectSlot) {
      ticket.rejectSlot(new Error('Stahování bylo zrušeno uživatelem.'));
    }
    removed = true;
  }

  if (activeDownloadLeases.has(clientId)) {
    releaseDownloadLease(clientId, 'canceled');
    removed = true;
  } else if (removed) {
    broadcastQueueState({ immediate: true });
    drainQueues();
  }

  return removed;
}

function promoteWithPriority(clientId, consumeFn) {
  const idx = downloadQueue.findIndex((t) => t.clientId === clientId);
  if (idx === -1) {
    return { ok: false, error: 'Nejsi aktuálně ve čekací frontě.' };
  }

  const ticket = downloadQueue[idx];
  if (ticket.hasPriority) {
    return { ok: false, error: 'Priorita je pro toto stahování již aktivní.' };
  }

  if (idx === 0) {
    return { ok: false, error: 'Už jsi první na řadě hned za aktivními uživateli.' };
  }

  const quotaResult = consumeFn();
  if (!quotaResult.ok) {
    return { ok: false, error: 'Vyčerpal jsi všechny 3 týdenní priority.', quota: quotaResult };
  }

  ticket.hasPriority = true;
  ticket.priorityAt = Date.now();
  sortDownloadQueue();

  const newPos = downloadQueue.findIndex((t) => t.id === ticket.id) + 1;
  broadcastQueueState({ immediate: true });

  return {
    ok: true,
    position: newPos,
    quota: quotaResult,
  };
}

function updateLeaseBatchInfo(clientId, { totalBytes, fileName }) {
  const lease = activeDownloadLeases.get(clientId);
  if (!lease) return;
  if (typeof totalBytes === 'number' && totalBytes > 0) {
    lease.totalBytes = totalBytes;
  }
  if (fileName) {
    lease.fileName = fileName;
  }
  broadcastQueueState();
}

/**
 * Executes an FTPS download/tree operation under a client's active download lease.
 * Provides full immunity during transfer and starts the 7s grace countdown afterward.
 */
async function withDownloadTransfer(clientId, credentials, meta, actionFn) {
  const { fileName = '', totalBytes = 0, isBatch = false, onRegisterAbort = null } = meta || {};

  let lease = activeDownloadLeases.get(clientId);
  if (!lease) {
    if (activeDownloadLeases.size < MAX_DOWNLOAD_SLOTS) {
      lease = createDownloadLease({
        clientId,
        fingerprintKey: '',
        fileName: fileName || 'Soubor',
        totalBytes: totalBytes || 0,
        type: 'file',
      });
    } else {
      const err = new Error('Všechny sloty pro stahování jsou obsazené.');
      err.code = 'QUEUE_FULL';
      throw err;
    }
  }

  if (lease.canceled) {
    const err = new Error('Stahování bylo zrušeno.');
    err.code = 'ERR_ABORTED';
    throw err;
  }

  clearLeaseTimers(lease);
  lease.activeTransfers++;
  lease.status = 'downloading';
  lease.graceEndsAt = null;
  if (fileName && !isBatch) {
    lease.fileName = fileName;
  }
  if (!isBatch && totalBytes > 0) {
    lease.totalBytes = totalBytes;
  }
  const baseTransferred = isBatch ? lease.transferredBytes : 0;
  if (!isBatch) {
    lease.transferredBytes = 0;
    lease.speedBps = 0;
    lease.etaSeconds = null;
  }

  broadcastQueueState({ immediate: true });

  let entry = null;
  let broken = false;
  let transferAborted = false;
  let lastTickTime = Date.now();
  let bytesInTick = 0;

  const abortEntry = () => {
    transferAborted = true;
    if (entry && entry.client) {
      try {
        entry.client.close();
      } catch (_) {}
    }
  };
  lease.abortCallbacks.add(abortEntry);
  if (onRegisterAbort) {
    onRegisterAbort(abortEntry);
  }

  const updateProgress = (currentFileBytes, knownFileSize) => {
    if (!isBatch && knownFileSize && (!lease.totalBytes || lease.totalBytes < knownFileSize)) {
      lease.totalBytes = knownFileSize;
    }
    lease.transferredBytes = baseTransferred + currentFileBytes;
    bytesInTick += 0; // handled by addChunkBytes below
  };

  const addChunkBytes = (chunkLen) => {
    lease.transferredBytes += chunkLen;
    bytesInTick += chunkLen;

    const now = Date.now();
    const dt = (now - lastTickTime) / 1000;
    if (dt >= 0.4) {
      const instantSpeed = bytesInTick / dt;
      lease.speedBps = lease.speedBps > 0 ? lease.speedBps * 0.4 + instantSpeed * 0.6 : instantSpeed;
      bytesInTick = 0;
      lastTickTime = now;

      if (lease.totalBytes > lease.transferredBytes && lease.speedBps > 0) {
        lease.etaSeconds = Math.max(1, Math.ceil((lease.totalBytes - lease.transferredBytes) / lease.speedBps));
      } else {
        lease.etaSeconds = null;
      }
      broadcastQueueState();
    }
  };

  const setKnownSize = (knownFileSize) => {
    if (!isBatch && knownFileSize > 0 && (!lease.totalBytes || lease.totalBytes < knownFileSize)) {
      lease.totalBytes = knownFileSize;
      broadcastQueueState();
    }
  };

  try {
    entry = await acquirePhysicalClient(credentials);
    if (transferAborted || lease.canceled) {
      throw Object.assign(new Error('Přenos byl zrušen.'), { code: 'ERR_ABORTED' });
    }
    return await actionFn(entry.client, { addChunkBytes, updateProgress, setKnownSize, abortEntry });
  } catch (err) {
    broken = true;
    throw err;
  } finally {
    lease.abortCallbacks.delete(abortEntry);
    if (entry) {
      releasePhysicalClient(entry, { broken: broken || transferAborted });
    }
    lease.activeTransfers = Math.max(0, lease.activeTransfers - 1);
    if (lease.activeTransfers === 0) {
      if (lease.canceled) {
        releaseDownloadLease(clientId, 'canceled');
      } else {
        startDownloadGraceTimer(lease);
      }
    } else {
      broadcastQueueState();
    }
  }
}

function drainQueues() {
  const maxBrowse = getCurrentMaxBrowseSlots();

  while (
    browseQueue.length > 0 &&
    activeBrowseTasks.size < maxBrowse &&
    activeBrowseTasks.size + activeDownloadLeases.size <= MAX_TOTAL
  ) {
    // Check if there are enough physical connection slots not needed by active/waiting tasks
    const busyCount = physicalPool.filter((e) => e.busy).length + creatingCount;
    if (busyCount + physicalWaiters.length >= MAX_TOTAL) {
      break;
    }
    const task = browseQueue.shift();
    if (!task) break;
    runBrowseTask(task);
  }
}

module.exports = {
  isPermanentFtpError,
  enqueueBrowse,
  requestDownloadSlot,
  cancelDownloadSlot,
  promoteWithPriority,
  withDownloadTransfer,
  updateLeaseBatchInfo,
  addSseClient,
  buildStateSnapshotFor,
  broadcastQueueState,
};
