import { useState, useRef, useCallback } from 'react';
import JSZip from 'jszip';
import { useQueue } from '../context/QueueContext';

export function useDownloadManager() {
  const { requestDownloadSlot, cancelDownloadSlot } = useQueue();

  const [downloadState, setDownloadState] = useState({
    active: false,
    type: 'file', // 'file' | 'folder'
    name: '',
    path: '',
    phase: 'idle', // 'idle' | 'queued' | 'scanning' | 'downloading' | 'compressing' | 'done' | 'error'
    queuePosition: 0,
    percent: 0,
    speed: 0, // bytes per second
    processedBytes: 0,
    totalBytes: 0,
    currentFile: '',
    processedFiles: 0,
    totalFiles: 0,
    error: null,
  });

  const abortControllerRef = useRef(null);

  const cancelDownload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    cancelDownloadSlot();
    setDownloadState((prev) => ({
      ...prev,
      phase: 'error',
      speed: 0,
      error: 'Stahování bylo zrušeno uživatelem.',
    }));
  }, [cancelDownloadSlot]);

  const closeToast = useCallback(() => {
    if (
      downloadState.phase === 'queued' ||
      downloadState.phase === 'downloading' ||
      downloadState.phase === 'scanning' ||
      downloadState.phase === 'compressing'
    ) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      cancelDownloadSlot();
    }
    setDownloadState((prev) => ({ ...prev, active: false, phase: 'idle', speed: 0 }));
  }, [downloadState.phase, cancelDownloadSlot]);

  // Single file in-browser download with queue slot acquisition and stream progress
  const startFileDownload = useCallback(async (item) => {
    if (!item) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const totalExpectedBytes = item.size || 0;

    setDownloadState({
      active: true,
      type: 'file',
      name: item.name,
      path: item.path,
      phase: 'downloading',
      queuePosition: 0,
      percent: 0,
      speed: 0,
      processedBytes: 0,
      totalBytes: totalExpectedBytes,
      currentFile: item.name,
      processedFiles: 0,
      totalFiles: 1,
      error: null,
    });

    try {
      // Acquire download slot (waits in queue if all 4 download slots are full)
      await requestDownloadSlot({
        name: item.name,
        totalBytes: totalExpectedBytes,
        type: 'file',
        signal: abortController.signal,
        onQueued: (position) => {
          setDownloadState((prev) => ({
            ...prev,
            phase: 'queued',
            queuePosition: position,
          }));
        },
      });

      if (abortController.signal.aborted) return;

      setDownloadState((prev) => ({
        ...prev,
        phase: 'downloading',
        queuePosition: 0,
      }));

      const res = await fetch(
        `/api/files/download?path=${encodeURIComponent(item.path)}&size=${totalExpectedBytes}`,
        { signal: abortController.signal }
      );

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || 'Nepodařilo se stáhnout soubor ze serveru.');
      }

      const contentLength =
        parseInt(res.headers.get('content-length'), 10) || totalExpectedBytes;
      const reader = res.body ? res.body.getReader() : null;

      let blob;
      if (reader) {
        const chunks = [];
        let received = 0;
        let lastTime = performance.now();
        let bytesSinceLast = 0;
        let currentSpeed = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          chunks.push(value);
          received += value.length;
          bytesSinceLast += value.length;

          const now = performance.now();
          const elapsed = (now - lastTime) / 1000;
          if (elapsed >= 0.25) {
            currentSpeed = bytesSinceLast / elapsed;
            bytesSinceLast = 0;
            lastTime = now;

            const percent =
              contentLength > 0
                ? Math.min(99, Math.round((received / contentLength) * 100))
                : 50;

            setDownloadState((prev) => ({
              ...prev,
              processedBytes: received,
              totalBytes: Math.max(contentLength, received),
              percent,
              speed: currentSpeed,
            }));
          }
        }

        blob = new Blob(chunks, {
          type: res.headers.get('content-type') || 'application/octet-stream',
        });
      } else {
        blob = await res.blob();
      }

      if (abortController.signal.aborted) return;

      // Trigger browser save prompt
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = item.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => URL.revokeObjectURL(downloadUrl), 10000);

      setDownloadState((prev) => ({
        ...prev,
        phase: 'done',
        percent: 100,
        processedBytes: blob.size,
        totalBytes: blob.size,
        speed: 0,
      }));

      setTimeout(() => {
        setDownloadState((prev) =>
          prev.phase === 'done' ? { ...prev, active: false, phase: 'idle' } : prev
        );
      }, 5000);
    } catch (err) {
      if (err.name === 'AbortError' || abortController.signal.aborted) {
        return;
      }
      setDownloadState((prev) => ({
        ...prev,
        phase: 'error',
        speed: 0,
        error: err.message || 'Chyba při stahování souboru.',
      }));
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  }, [requestDownloadSlot]);

  // Folder ZIP in-browser download with queue slot acquisition and stream progress
  const startFolderDownload = useCallback(async (item) => {
    if (!item) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const folderPath = item.path;
    const name = item.name || folderPath.split('/').filter(Boolean).pop() || 'slozka';

    setDownloadState({
      active: true,
      type: 'folder',
      name: `${name}.zip`,
      path: folderPath,
      phase: 'scanning',
      queuePosition: 0,
      percent: 0,
      speed: 0,
      currentFile: '',
      processedFiles: 0,
      totalFiles: 0,
      processedBytes: 0,
      totalBytes: 0,
      error: null,
    });

    try {
      // 1. Acquire download slot first (before scanning tree)
      await requestDownloadSlot({
        name: `${name}.zip`,
        totalBytes: 0,
        type: 'folder',
        signal: abortController.signal,
        onQueued: (position) => {
          setDownloadState((prev) => ({
            ...prev,
            phase: 'queued',
            queuePosition: position,
          }));
        },
      });

      if (abortController.signal.aborted) return;

      setDownloadState((prev) => ({
        ...prev,
        phase: 'scanning',
        queuePosition: 0,
      }));

      // 2. Scan tree inside the user's download slot
      const treeRes = await fetch(
        `/api/files/tree?path=${encodeURIComponent(folderPath)}&download=1`,
        { signal: abortController.signal }
      );

      if (!treeRes.ok) {
        const errorData = await treeRes.json().catch(() => ({}));
        throw new Error(
          errorData.error || 'Nepodařilo se prohledat strukturu složky.'
        );
      }

      const tree = await treeRes.json();
      if (!tree.files || tree.files.length === 0) {
        cancelDownloadSlot();
        setDownloadState((prev) => ({
          ...prev,
          phase: 'error',
          speed: 0,
          error: 'Složka je prázdná – neobsahuje žádné soubory ke stažení.',
        }));
        return;
      }

      setDownloadState((prev) => ({
        ...prev,
        phase: 'downloading',
        totalFiles: tree.totalFiles,
        totalBytes: tree.totalSize,
        percent: 5,
      }));

      // 3. Download each file with speed measurement inside the same immune slot
      const zip = new JSZip();
      let totalReceivedAcrossFiles = 0;
      let lastTime = performance.now();
      let bytesSinceLast = 0;
      let currentSpeed = 0;

      for (let i = 0; i < tree.files.length; i++) {
        if (abortController.signal.aborted) return;

        const file = tree.files[i];
        setDownloadState((prev) => ({
          ...prev,
          currentFile: file.name,
          processedFiles: i,
          percent: Math.min(80, Math.round(5 + ((i / tree.files.length) * 75))),
        }));

        const fileRes = await fetch(
          `/api/files/download?path=${encodeURIComponent(file.path)}&size=${file.size || 0}&batch=1`,
          { signal: abortController.signal }
        );

        if (!fileRes.ok) {
          throw new Error(`Chyba při stahování souboru ${file.name}`);
        }

        const reader = fileRes.body ? fileRes.body.getReader() : null;
        let fileBuffer;

        if (reader) {
          const chunks = [];
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            chunks.push(value);
            totalReceivedAcrossFiles += value.length;
            bytesSinceLast += value.length;

            const now = performance.now();
            const elapsed = (now - lastTime) / 1000;
            if (elapsed >= 0.25) {
              currentSpeed = bytesSinceLast / elapsed;
              bytesSinceLast = 0;
              lastTime = now;

              setDownloadState((prev) => ({
                ...prev,
                processedBytes: totalReceivedAcrossFiles,
                speed: currentSpeed,
                percent: Math.min(
                  80,
                  Math.round(5 + ((i / tree.files.length) * 75))
                ),
              }));
            }
          }
          const combined = new Uint8Array(
            chunks.reduce((acc, c) => acc + c.length, 0)
          );
          let offset = 0;
          for (const c of chunks) {
            combined.set(c, offset);
            offset += c.length;
          }
          fileBuffer = combined.buffer;
        } else {
          fileBuffer = await fileRes.arrayBuffer();
          totalReceivedAcrossFiles += file.size;
        }

        zip.file(file.relativePath, fileBuffer);

        setDownloadState((prev) => ({
          ...prev,
          processedBytes: totalReceivedAcrossFiles,
          processedFiles: i + 1,
          percent: Math.min(
            80,
            Math.round(5 + (((i + 1) / tree.files.length) * 75))
          ),
        }));
      }

      // 4. Compress ZIP in browser (server slot enters 7s grace)
      setDownloadState((prev) => ({
        ...prev,
        phase: 'compressing',
        currentFile: '',
        speed: 0,
        percent: 82,
      }));

      const zipBlob = await zip.generateAsync(
        {
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 },
        },
        (metadata) => {
          setDownloadState((prev) => ({
            ...prev,
            percent: Math.min(99, Math.round(80 + metadata.percent * 0.19)),
          }));
        }
      );

      if (abortController.signal.aborted) return;

      // 5. Trigger download in browser
      const downloadUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${name}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => URL.revokeObjectURL(downloadUrl), 10000);

      setDownloadState((prev) => ({
        ...prev,
        phase: 'done',
        percent: 100,
        speed: 0,
      }));

      setTimeout(() => {
        setDownloadState((prev) =>
          prev.phase === 'done' ? { ...prev, active: false, phase: 'idle' } : prev
        );
      }, 5000);
    } catch (err) {
      if (err.name === 'AbortError' || abortController.signal.aborted) {
        return;
      }
      setDownloadState((prev) => ({
        ...prev,
        phase: 'error',
        speed: 0,
        error: err.message || 'Chyba při přípravě ZIP archivu.',
      }));
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  }, [requestDownloadSlot, cancelDownloadSlot]);

  return {
    downloadState,
    startFileDownload,
    startFolderDownload,
    cancelDownload,
    closeToast,
  };
}
