import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from './context/AuthContext';
import { useQueue } from './context/QueueContext';
import Navbar from './components/Navbar';
import Breadcrumbs from './components/Breadcrumbs';
import Toolbar from './components/Toolbar';
import FileList from './components/FileList';
import FileGrid from './components/FileGrid';
import LoginModal from './components/LoginModal';
import ImagePreviewModal from './components/Modals/ImagePreviewModal';
import AudioPreviewModal from './components/Modals/AudioPreviewModal';
import VideoPreviewModal from './components/Modals/VideoPreviewModal';
import PdfPreviewModal from './components/Modals/PdfPreviewModal';
import TextViewerModal from './components/Modals/TextViewerModal';
import ZipDownloadToast from './components/ZipDownloadToast';
import QueueWidget from './components/QueueWidget';
import { useDownloadManager } from './utils/useDownloadManager';
import { getFileCategory, formatBytes, COMMIT_ID } from './utils/formatters';
import { Loader2, FolderOpen, AlertCircle, Mail } from 'lucide-react';

// Fast client-side cache for instant directory transitions
const clientDirCache = new Map(); // path -> { items, currentPath, timestamp }
const inflightPrefetches = new Map(); // path -> Promise

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const { queueState } = useQueue();

  // Navigation & Files state: default to '/Vyuka'
  const [currentPath, setCurrentPath] = useState('/Vyuka');
  const [items, setItems] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeBrowseId, setActiveBrowseId] = useState(null);

  // Filter & Display controls: default to 'list'
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  // Preview Modals state
  const [imagePreview, setImagePreview] = useState(null);
  const [audioPreview, setAudioPreview] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [pdfPreview, setPdfPreview] = useState(null);
  const [textViewerFile, setTextViewerFile] = useState(null);

  // In-browser Download Manager (files & folders with queue + speed tracking)
  const {
    downloadState,
    startFileDownload,
    startFolderDownload,
    cancelDownload,
    closeToast,
  } = useDownloadManager();

  // Warm FTPS connection TTL countdown (20s browse / 7s post-download grace)
  const [connectionTtl, setConnectionTtl] = useState(20);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [isReconnecting, setIsReconnecting] = useState(false);
  const connectionTtlRef = useRef(20);

  const resetConnectionTtl = useCallback(() => {
    setLastActivity(Date.now());
    setConnectionTtl(20);
    connectionTtlRef.current = 20;
    setIsReconnecting(false);
  }, []);

  // Sync Navbar TTL when user's download finishes and enters 7s grace
  useEffect(() => {
    const yourSlot = queueState?.yourActiveSlot;
    if (yourSlot && yourSlot.status === 'grace' && yourSlot.graceEndsAt) {
      setLastActivity(yourSlot.graceEndsAt - 20000);
    }
  }, [queueState?.yourActiveSlot?.status, queueState?.yourActiveSlot?.graceEndsAt]);

  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastActivity) / 1000);
      const remaining = Math.max(0, 20 - elapsed);
      setConnectionTtl(remaining);
      connectionTtlRef.current = remaining;
    }, 500);

    return () => clearInterval(timer);
  }, [lastActivity]);

  const isDownloadImmune = queueState?.yourActiveSlot?.status === 'downloading';

  // Compute live browse queue position while waiting on an uncached directory
  const currentBrowseEntry = useMemo(() => {
    if (!activeBrowseId || !queueState?.browse?.items) return null;
    return queueState.browse.items.find((item) => item.browseId === activeBrowseId) || null;
  }, [activeBrowseId, queueState?.browse?.items]);

  const browseAheadCount =
    currentBrowseEntry && currentBrowseEntry.status === 'queued'
      ? currentBrowseEntry.aheadCount
      : 0;

  // Prefetch directory on hover (debounced in FileList/FileGrid; only when warm)
  const prefetch = useCallback((targetPath) => {
    if (!user || !targetPath) return;
    if (targetPath.includes('#recycle') || targetPath.includes('@eaDir')) return;
    if (connectionTtlRef.current === 0) return;
    if (clientDirCache.has(targetPath)) return;
    if (inflightPrefetches.has(targetPath)) return;

    const req = fetch(`/api/files/list?path=${encodeURIComponent(targetPath)}&prefetch=1`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && !data.skipped && data.items) {
          clientDirCache.set(targetPath, {
            items: data.items,
            currentPath: data.currentPath || targetPath,
            timestamp: Date.now(),
          });
          resetConnectionTtl();
        }
      })
      .catch(() => {})
      .finally(() => {
        inflightPrefetches.delete(targetPath);
      });

    inflightPrefetches.set(targetPath, req);
  }, [user, resetConnectionTtl]);

  // Fetch files in directory with instant SWR, browse queue tracking, and refresh support
  const loadFiles = useCallback(async (targetPath = currentPath, isRefresh = false) => {
    if (!user) return;

    if (connectionTtlRef.current === 0) {
      setIsReconnecting(true);
    }

    if (isRefresh) {
      clientDirCache.delete(targetPath);
      setRefreshing(true);
    } else {
      const cached = clientDirCache.get(targetPath);
      if (cached) {
        setItems(cached.items || []);
        setCurrentPath(cached.currentPath || targetPath);
      } else {
        setLoadingFiles(true);
      }
    }
    setError(null);

    const browseId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setActiveBrowseId(browseId);

    try {
      const url = `/api/files/list?path=${encodeURIComponent(targetPath)}&browseId=${encodeURIComponent(browseId)}${
        isRefresh ? '&refresh=true&_t=' + Date.now() : ''
      }`;
      const res = await fetch(url, { cache: isRefresh ? 'no-store' : 'default' });
      const data = await res.json();

      if (!res.ok) {
        if (targetPath === '/Vyuka') {
          const fallbackRes = await fetch(`/api/files/list?path=/&browseId=${encodeURIComponent(browseId)}`);
          const fallbackData = await fallbackRes.json();
          if (fallbackRes.ok) {
            clientDirCache.set('/', {
              items: fallbackData.items || [],
              currentPath: '/',
              timestamp: Date.now(),
            });
            setItems(fallbackData.items || []);
            setCurrentPath('/');
            resetConnectionTtl();
            return;
          }
        }
        throw new Error(data.error || 'Server je přetížený 😭.');
      }

      clientDirCache.set(targetPath, {
        items: data.items || [],
        currentPath: data.currentPath || targetPath,
        timestamp: Date.now(),
      });

      setItems(data.items || []);
      setCurrentPath(data.currentPath || targetPath);
      resetConnectionTtl();
    } catch (err) {
      setError(err.message);
    } finally {
      setActiveBrowseId(null);
      setIsReconnecting(false);
      setLoadingFiles(false);
      setRefreshing(false);
    }
  }, [user, currentPath, resetConnectionTtl]);

  useEffect(() => {
    if (user) {
      loadFiles(currentPath);
    }
  }, [user, currentPath]);

  // Filtered and sorted files
  const filteredAndSortedItems = useMemo(() => {
    let result = [...items];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((item) => item.name.toLowerCase().includes(q));
    }

    result.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;

      let compareVal = 0;
      if (sortBy === 'name') {
        compareVal = a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
      } else if (sortBy === 'size') {
        compareVal = (a.size || 0) - (b.size || 0);
      } else if (sortBy === 'date') {
        const timeA = a.modifiedAt ? new Date(a.modifiedAt).getTime() : 0;
        const timeB = b.modifiedAt ? new Date(b.modifiedAt).getTime() : 0;
        compareVal = timeA - timeB;
      }

      return sortOrder === 'asc' ? compareVal : -compareVal;
    });

    return result;
  }, [items, searchQuery, sortBy, sortOrder]);

  // Stats
  const stats = useMemo(() => {
    const folders = items.filter((i) => i.isDirectory).length;
    const files = items.filter((i) => !i.isDirectory).length;
    const totalSize = items.reduce((acc, i) => acc + (i.isDirectory ? 0 : i.size || 0), 0);
    return { folders, files, totalSize };
  }, [items]);

  // Preview router
  const handlePreview = (item) => {
    const category = getFileCategory(item.name);
    if (category === 'image') setImagePreview(item);
    else if (category === 'audio') setAudioPreview(item);
    else if (category === 'video') setVideoPreview(item);
    else if (category === 'pdf') setPdfPreview(item);
    else if (category === 'code') setTextViewerFile(item);
    else {
      startFileDownload(item);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-400 gap-2">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-300" />
        <span className="text-xs font-mono">Načítám relaci...</span>
      </div>
    );
  }

  if (!user) {
    return <LoginModal />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col text-zinc-100">
      {/* Top Navigation */}
      <Navbar
        onRefresh={() => loadFiles(currentPath, true)}
        refreshing={refreshing}
        connectionTtl={connectionTtl}
        isReconnecting={isReconnecting}
        isDownloadImmune={isDownloadImmune}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 flex flex-col gap-4">
        {/* Breadcrumbs path */}
        <Breadcrumbs
          currentPath={currentPath}
          onNavigate={(path) => loadFiles(path)}
          onPrefetch={prefetch}
        />

        {/* Action Toolbar */}
        <Toolbar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          viewMode={viewMode}
          setViewMode={setViewMode}
          sortBy={sortBy}
          setSortBy={setSortBy}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          totalItems={filteredAndSortedItems.length}
        />

        {/* Error notification */}
        {error && (
          <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Chyba při komunikaci se serverem</div>
              <div className="text-red-400/90 mt-0.5">{error}</div>
            </div>
          </div>
        )}

        {/* File Browser List or Grid */}
        <div className="flex-1">
          {loadingFiles ? (
            <div className="py-20 flex flex-col items-center justify-center text-zinc-400 gap-2 text-center px-4">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-300" />
              <span className="text-xs font-mono">
                {browseAheadCount > 0
                  ? `Fronta procházení: před tebou zpracovávám požadavek pro ${browseAheadCount} ${
                      browseAheadCount === 1
                        ? 'člověka'
                        : browseAheadCount >= 2 && browseAheadCount <= 4
                        ? 'lidi'
                        : 'lidí'
                    }...`
                  : 'Načítám soubory...'}
              </span>
              {browseAheadCount > 0 && (
                <span className="text-[11px] text-zinc-500">
                  Složka se automaticky otevře, jakmile přijdeš na řadu.
                </span>
              )}
            </div>
          ) : filteredAndSortedItems.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center p-6 rounded-lg border border-zinc-800/80 bg-zinc-900/30">
              <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-500 mb-2">
                <FolderOpen className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-medium text-zinc-300">
                {searchQuery ? 'Nenalezeny žádné odpovídající soubory' : 'Složka je prázdná'}
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                {searchQuery && 'Zkuste upravit vyhledávací dotaz.'}
              </p>
            </div>
          ) : viewMode === 'list' ? (
            <FileList
              items={filteredAndSortedItems}
              onNavigate={(path) => loadFiles(path)}
              onPreview={handlePreview}
              onPrefetch={prefetch}
              onDownloadFolder={startFolderDownload}
              onDownloadFile={startFileDownload}
            />
          ) : (
            <FileGrid
              items={filteredAndSortedItems}
              onNavigate={(path) => loadFiles(path)}
              onPreview={handlePreview}
              onPrefetch={prefetch}
              onDownloadFolder={startFolderDownload}
              onDownloadFile={startFileDownload}
            />
          )}
        </div>
      </main>

      {/* Footer bar */}
      <footer className="border-t border-zinc-800/80 bg-zinc-950 py-2.5 text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 font-mono text-[11px]">
          <div className="flex items-center gap-3">
            <a
              href="mailto:tomas.pachomov@frengp.cz"
              className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <Mail className="w-3.5 h-3.5 text-zinc-500" />
              <span>tomas.pachomov@frengp.cz</span>
            </a>
            <span className="text-zinc-700 hidden sm:inline">•</span>
            <span className="hidden sm:inline">Celkem: {stats.folders} složek, {stats.files} souborů</span>
            {stats.files > 0 && <span className="hidden sm:inline"> ({formatBytes(stats.totalSize)})</span>}
          </div>
          <div className="flex items-center gap-2 text-zinc-600">
            <span>FTPS TLS 1.3 • {user?.username}@{user?.host}</span>
            {COMMIT_ID && (
              <>
                <span className="text-zinc-700">•</span>
                <span className="text-zinc-500 font-mono select-none">{COMMIT_ID}</span>
              </>
            )}
          </div>
        </div>
      </footer>

      {/* Preview Modals */}
      <ImagePreviewModal
        isOpen={Boolean(imagePreview)}
        file={imagePreview}
        onClose={() => setImagePreview(null)}
        onDownloadFile={startFileDownload}
      />

      <AudioPreviewModal
        isOpen={Boolean(audioPreview)}
        file={audioPreview}
        onClose={() => setAudioPreview(null)}
        onDownloadFile={startFileDownload}
      />

      <VideoPreviewModal
        isOpen={Boolean(videoPreview)}
        file={videoPreview}
        onClose={() => setVideoPreview(null)}
        onDownloadFile={startFileDownload}
      />

      <PdfPreviewModal
        isOpen={Boolean(pdfPreview)}
        file={pdfPreview}
        onClose={() => setPdfPreview(null)}
        onDownloadFile={startFileDownload}
      />

      <TextViewerModal
        isOpen={Boolean(textViewerFile)}
        file={textViewerFile}
        onClose={() => setTextViewerFile(null)}
        onDownloadFile={startFileDownload}
      />

      {/* Bottom-right floating stack: Download Toast above Interactive Queue Widget */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end gap-3 pointer-events-none">
        <div className="pointer-events-auto">
          <ZipDownloadToast
            state={downloadState}
            queuePosition={queueState?.yourWaitingTicket?.position}
            hasPriority={Boolean(queueState?.yourWaitingTicket?.hasPriority)}
            onCancel={cancelDownload}
            onClose={closeToast}
          />
        </div>
        <div className="pointer-events-auto">
          <QueueWidget onCancelDownload={cancelDownload} />
        </div>
      </div>
    </div>
  );
}
