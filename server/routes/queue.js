const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const queueManager = require('../queueManager');
const priorityStore = require('../priorityStore');

router.use(authMiddleware);

/**
 * GET /api/queue/stream
 * Server-Sent Events stream with live download/browse queue status.
 */
router.get('/stream', (req, res) => {
  const clientId = priorityStore.getOrCreateQueueClientId(req, res);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (res.flushHeaders) {
    res.flushHeaders();
  }

  const cleanup = queueManager.addSseClient(clientId, res);

  res.on('close', cleanup);
});

/**
 * GET /api/queue/status
 * Returns current queue snapshot and this device's weekly Priority quota.
 */
router.get('/status', (req, res) => {
  const clientId = priorityStore.getOrCreateQueueClientId(req, res);
  const fp = req.headers['x-device-fingerprint'] || req.query.fp || '';
  const fingerprintKey = priorityStore.deriveFingerprintKey(req, fp);

  res.json({
    queue: queueManager.buildStateSnapshotFor(clientId),
    priorityQuota: priorityStore.getPriorityStatus(fingerprintKey),
  });
});

/**
 * POST /api/queue/request-download
 * Acquires a download slot immediately or places the user into the waiting queue.
 */
router.post('/request-download', (req, res) => {
  const clientId = priorityStore.getOrCreateQueueClientId(req, res);
  const { fileName, totalBytes, type, fingerprint } = req.body || {};
  const fp = fingerprint || req.headers['x-device-fingerprint'] || '';
  const fingerprintKey = priorityStore.deriveFingerprintKey(req, fp);

  const result = queueManager.requestDownloadSlot({
    clientId,
    fingerprintKey,
    fileName: fileName || 'Soubor',
    totalBytes: parseInt(totalBytes, 10) || 0,
    type: type === 'folder' ? 'folder' : 'file',
  });

  res.json({
    status: result.status,
    position: result.position || 0,
    ticketId: result.ticketId || null,
    priorityQuota: priorityStore.getPriorityStatus(fingerprintKey),
  });
});

/**
 * POST /api/queue/priority
 * Spends 1 of 3 weekly Priority tokens to jump directly behind active downloaders.
 */
router.post('/priority', (req, res) => {
  const clientId = priorityStore.getOrCreateQueueClientId(req, res);
  const { fingerprint } = req.body || {};
  const fp = fingerprint || req.headers['x-device-fingerprint'] || '';
  const fingerprintKey = priorityStore.deriveFingerprintKey(req, fp);

  const result = queueManager.promoteWithPriority(clientId, () =>
    priorityStore.consumePriority(fingerprintKey)
  );

  if (!result.ok) {
    return res.status(400).json({
      error: result.error,
      priorityQuota: result.quota || priorityStore.getPriorityStatus(fingerprintKey),
    });
  }

  res.json({
    success: true,
    position: result.position,
    priorityQuota: result.quota,
  });
});

/**
 * POST /api/queue/cancel
 * Cancels the user's waiting ticket or active download slot immediately.
 */
router.post('/cancel', (req, res) => {
  const clientId = priorityStore.getOrCreateQueueClientId(req, res);
  queueManager.cancelDownloadSlot(clientId);
  res.json({ success: true });
});

module.exports = router;
