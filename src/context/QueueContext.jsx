import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { useAuth } from './AuthContext';
import { getDeviceFingerprint } from '../utils/fingerprint';

const QueueContext = createContext(null);

const EMPTY_QUEUE_STATE = {
  mode: '5/0',
  slots: {
    total: 5,
    maxDownloads: 4,
    activeDownloads: 0,
    maxBrowse: 5,
    activeBrowse: 0,
    waitingBrowse: 0,
  },
  active: [],
  waiting: [],
  browse: { activeCount: 0, waitingCount: 0, items: [] },
  yourActiveSlot: null,
  yourWaitingTicket: null,
};

export function QueueProvider({ children }) {
  const { user } = useAuth();
  const [queueState, setQueueState] = useState(EMPTY_QUEUE_STATE);
  const [priorityQuota, setPriorityQuota] = useState({ used: 0, remaining: 3, max: 3 });

  const queueStateRef = useRef(EMPTY_QUEUE_STATE);
  const slotWaiterRef = useRef(null); // { resolve, reject }

  const applyQueueState = useCallback((nextState) => {
    if (!nextState) return;
    queueStateRef.current = nextState;
    setQueueState(nextState);

    if (slotWaiterRef.current && nextState.yourActiveSlot) {
      const waiter = slotWaiterRef.current;
      slotWaiterRef.current = null;
      waiter.resolve(nextState.yourActiveSlot);
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    if (!user) return null;
    try {
      const fp = await getDeviceFingerprint();
      const res = await fetch('/api/queue/status', {
        cache: 'no-store',
        headers: { 'X-Device-Fingerprint': fp },
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.queue) applyQueueState(data.queue);
      if (data.priorityQuota) setPriorityQuota(data.priorityQuota);
      return data;
    } catch (_) {
      return null;
    }
  }, [user, applyQueueState]);

  // Connect live SSE stream when logged in
  useEffect(() => {
    if (!user) {
      setQueueState(EMPTY_QUEUE_STATE);
      queueStateRef.current = EMPTY_QUEUE_STATE;
      if (slotWaiterRef.current) {
        const err = new Error('Odhlášeno.');
        err.name = 'AbortError';
        slotWaiterRef.current.reject(err);
        slotWaiterRef.current = null;
      }
      return;
    }

    let eventSource = null;
    let reconnectTimer = null;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      eventSource = new EventSource('/api/queue/stream');

      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          applyQueueState(parsed);
        } catch (_) {}
      };

      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (!cancelled && !reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect();
          }, 2000);
        }
      };
    };

    refreshStatus().then(() => {
      if (!cancelled) connect();
    });

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (eventSource) eventSource.close();
    };
  }, [user, applyQueueState, refreshStatus]);

  const cancelDownloadSlot = useCallback(async () => {
    if (slotWaiterRef.current) {
      const waiter = slotWaiterRef.current;
      slotWaiterRef.current = null;
      const err = new Error('Stahování bylo zrušeno uživatelem.');
      err.name = 'AbortError';
      waiter.reject(err);
    }
    try {
      await fetch('/api/queue/cancel', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (_) {}
  }, []);

  const requestDownloadSlot = useCallback(
    async ({ name, totalBytes = 0, type = 'file', signal, onQueued }) => {
      // Cancel any previous pending queue waiter in this client
      if (slotWaiterRef.current) {
        const prev = slotWaiterRef.current;
        slotWaiterRef.current = null;
        const err = new Error('Nahrazeno novým stahováním.');
        err.name = 'AbortError';
        prev.reject(err);
      }

      const fp = await getDeviceFingerprint();
      const res = await fetch('/api/queue/request-download', {
        method: 'POST',
        cache: 'no-store',
        signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Fingerprint': fp,
        },
        body: JSON.stringify({
          fileName: name,
          totalBytes,
          type,
          fingerprint: fp,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Nepodařilo se získat slot pro stahování.');
      }

      const data = await res.json();
      if (data.priorityQuota) {
        setPriorityQuota(data.priorityQuota);
      }

      if (data.status === 'active') {
        return { granted: true };
      }

      if (onQueued) {
        onQueued(data.position || 1);
      }

      // Wait until SSE (or fallback poll) reports that our slot is granted
      await new Promise((resolve, reject) => {
        if (signal && signal.aborted) {
          const err = new Error('Stahování bylo zrušeno.');
          err.name = 'AbortError';
          reject(err);
          return;
        }

        const onAbort = () => {
          if (slotWaiterRef.current) {
            slotWaiterRef.current = null;
          }
          const err = new Error('Stahování bylo zrušeno uživatelem.');
          err.name = 'AbortError';
          reject(err);
        };

        if (signal) {
          signal.addEventListener('abort', onAbort, { once: true });
        }

        const cleanupAndResolve = (val) => {
          clearInterval(pollTimer);
          if (signal) signal.removeEventListener('abort', onAbort);
          resolve(val);
        };

        const cleanupAndReject = (err) => {
          clearInterval(pollTimer);
          if (signal) signal.removeEventListener('abort', onAbort);
          reject(err);
        };

        slotWaiterRef.current = {
          resolve: cleanupAndResolve,
          reject: cleanupAndReject,
        };

        // Check immediately in case SSE arrived during the POST round-trip
        if (queueStateRef.current && queueStateRef.current.yourActiveSlot) {
          const waiter = slotWaiterRef.current;
          slotWaiterRef.current = null;
          waiter.resolve(queueStateRef.current.yourActiveSlot);
          return;
        }

        // Backup poll in case an SSE frame is delayed
        const pollTimer = setInterval(async () => {
          const snap = await refreshStatus();
          if (snap && snap.queue && snap.queue.yourActiveSlot && slotWaiterRef.current) {
            const waiter = slotWaiterRef.current;
            slotWaiterRef.current = null;
            waiter.resolve(snap.queue.yourActiveSlot);
          }
        }, 2000);
      });

      return { granted: true };
    },
    [refreshStatus]
  );

  const usePriority = useCallback(async () => {
    const fp = await getDeviceFingerprint();
    const res = await fetch('/api/queue/priority', {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Fingerprint': fp,
      },
      body: JSON.stringify({ fingerprint: fp }),
    });

    const data = await res.json();
    if (data.priorityQuota) {
      setPriorityQuota(data.priorityQuota);
    }

    if (!res.ok) {
      throw new Error(data.error || 'Nepodařilo se aktivovat prioritu.');
    }

    return data;
  }, []);

  return (
    <QueueContext.Provider
      value={{
        queueState,
        priorityQuota,
        requestDownloadSlot,
        cancelDownloadSlot,
        usePriority,
        refreshStatus,
      }}
    >
      {children}
    </QueueContext.Provider>
  );
}

export function useQueue() {
  const ctx = useContext(QueueContext);
  if (!ctx) {
    throw new Error('useQueue must be used within a QueueProvider');
  }
  return ctx;
}
