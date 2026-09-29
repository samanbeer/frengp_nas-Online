import { useState, useRef, useCallback } from 'react';
import JSZip from 'jszip';

export function useFolderZipDownload() {
  const [downloadState, setDownloadState] = useState({
    active: false,
    folderName: '',
    path: '',
    phase: 'idle', // 'idle' | 'scanning' | 'downloading' | 'compressing' | 'done' | 'error'
    percent: 0,
    currentFile: '',
    processedFiles: 0,
    totalFiles: 0,
    processedBytes: 0,
    totalBytes: 0,
    error: null,
  });

  const abortControllerRef = useRef(null);

  const cancelDownload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setDownloadState((prev) => ({
      ...prev,
      phase: 'error',
      error: 'Stahování bylo zrušeno uživatelem.',
    }));
  }, []);

  const closeToast = useCallback(() => {
    if (
      downloadState.phase === 'downloading' ||
      downloadState.phase === 'scanning' ||
      downloadState.phase === 'compressing'
    ) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    }
    setDownloadState((prev) => ({ ...prev, active: false, phase: 'idle' }));
  }, [downloadState.phase]);

  const startDownload = useCallback(async (folderPath, folderName) => {
    // If another download is ongoing, cancel it first
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const name =
      folderName ||
      folderPath.split('/').filter(Boolean).pop() ||
      'slozka';

    setDownloadState({
      active: true,
      folderName: name,
      path: folderPath,
      phase: 'scanning',
      percent: 0,
      currentFile: '',
      processedFiles: 0,
      totalFiles: 0,
      processedBytes: 0,
      totalBytes: 0,
      error: null,
    });

    try {
      // 1. Recursively scan directory tree
      const treeRes = await fetch(
        `/api/files/tree?path=${encodeURIComponent(folderPath)}`,
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
        setDownloadState((prev) => ({
          ...prev,
          phase: 'error',
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

      // 2. Download and pack each file into JSZip
      const zip = new JSZip();
      let processedBytes = 0;

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
          `/api/files/download?path=${encodeURIComponent(file.path)}`,
          { signal: abortController.signal }
        );

        if (!fileRes.ok) {
          throw new Error(`Chyba při stahování souboru ${file.name}`);
        }

        const buffer = await fileRes.arrayBuffer();
        zip.file(file.relativePath, buffer);

        processedBytes += file.size;
        setDownloadState((prev) => ({
          ...prev,
          processedBytes,
          processedFiles: i + 1,
          percent: Math.min(
            80,
            Math.round(5 + (((i + 1) / tree.files.length) * 75))
          ),
        }));
      }

      // 3. Compress / generate ZIP blob
      setDownloadState((prev) => ({
        ...prev,
        phase: 'compressing',
        currentFile: '',
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

      // 4. Trigger download in browser
      const downloadUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${name}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 10000);

      setDownloadState((prev) => ({
        ...prev,
        phase: 'done',
        percent: 100,
      }));

      // Automatically hide after 6 seconds
      setTimeout(() => {
        setDownloadState((prev) =>
          prev.phase === 'done' ? { ...prev, active: false, phase: 'idle' } : prev
        );
      }, 6000);
    } catch (err) {
      if (err.name === 'AbortError' || abortController.signal.aborted) {
        return;
      }
      setDownloadState((prev) => ({
        ...prev,
        phase: 'error',
        error: err.message || 'Chyba při přípravě ZIP archivu.',
      }));
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  }, []);

  return {
    downloadState,
    startDownload,
    cancelDownload,
    closeToast,
  };
}
