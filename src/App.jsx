import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
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
import { getFileCategory, formatBytes } from './utils/formatters';
import { Loader2, FolderOpen, AlertCircle } from 'lucide-react';

// Fast client-side cache for instant directory transitions
const clientDirCache = new Map(); // path -> { items, currentPath, timestamp }
const inflightPrefetches = new Map(); // path -> Promise

export default function App() {
  const { user, loading: authLoading } = useAuth();

  // Navigation & Files state: default to '/Vyuka'
  const [currentPath, setCurrentPath] = useState('/Vyuka');
  const [items, setItems] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

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

  // Prefetch directory on hover
  const prefetch = useCallback((targetPath) => {
    if (!user || !targetPath) return;
    if (clientDirCache.has(targetPath)) return;
    if (inflightPrefetches.has(targetPath)) return;

    const req = fetch(`/api/files/list?path=${encodeURIComponent(targetPath)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.items) {
          clientDirCache.set(targetPath, {
            items: data.items,
            currentPath: data.currentPath || targetPath,
            timestamp: Date.now(),
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        inflightPrefetches.delete(targetPath);
      });

    inflightPrefetches.set(targetPath, req);
  }, [user]);

  // Fetch files in directory with instant SWR and refresh support
  const loadFiles = useCallback(async (targetPath = currentPath, isRefresh = false) => {
    if (!user) return;

    if (isRefresh) {
      // Forced refresh: clear client cache for this directory
      clientDirCache.delete(targetPath);
      setRefreshing(true);
    } else {
      // Instant SWR: if cached, render immediately (0 ms)
      const cached = clientDirCache.get(targetPath);
      if (cached) {
        setItems(cached.items || []);
        setCurrentPath(cached.currentPath || targetPath);
      } else {
        setLoadingFiles(true);
      }
    }
    setError(null);

    try {
      const url = `/api/files/list?path=${encodeURIComponent(targetPath)}${isRefresh ? '&refresh=true&_t=' + Date.now() : ''}`;
      const res = await fetch(url, { cache: isRefresh ? 'no-store' : 'default' });
      const data = await res.json();

      if (!res.ok) {
        // If initial '/Vyuka' fails, try falling back to root '/'
        if (targetPath === '/Vyuka') {
          const fallbackRes = await fetch('/api/files/list?path=/');
          const fallbackData = await fallbackRes.json();
          if (fallbackRes.ok) {
            clientDirCache.set('/', {
              items: fallbackData.items || [],
              currentPath: '/',
              timestamp: Date.now(),
            });
            setItems(fallbackData.items || []);
            setCurrentPath('/');
            return;
          }
        }
        throw new Error(data.error || 'Nepodařilo se načíst soubory.');
      }

      // Update client cache
      clientDirCache.set(targetPath, {
        items: data.items || [],
        currentPath: data.currentPath || targetPath,
        timestamp: Date.now(),
      });

      setItems(data.items || []);
      setCurrentPath(data.currentPath || targetPath);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingFiles(false);
      setRefreshing(false);
    }
  }, [user, currentPath]);

  useEffect(() => {
    if (user) {
      loadFiles(currentPath);
    }
  }, [user, currentPath]);

  // Filtered and sorted files
  const filteredAndSortedItems = useMemo(() => {
    let result = [...items];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((item) => item.name.toLowerCase().includes(q));
    }

    // Sort
    result.sort((a, b) => {
      // Folders always stay first
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
      const url = `/api/files/download?path=${encodeURIComponent(item.path)}`;
      window.open(url, '_blank');
    }
  };

  // If still checking auth session
  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-400 gap-2">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-300" />
        <span className="text-xs font-mono">Načítám relaci...</span>
      </div>
    );
  }

  // If not logged in, render the login card
  if (!user) {
    return <LoginModal />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col text-zinc-100">
      {/* Top Navigation */}
      <Navbar
        onRefresh={() => loadFiles(currentPath, true)}
        refreshing={refreshing}
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
            <div className="py-20 flex flex-col items-center justify-center text-zinc-500 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
              <span className="text-xs font-mono">Načítám soubory...</span>
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
            />
          ) : (
            <FileGrid
              items={filteredAndSortedItems}
              onNavigate={(path) => loadFiles(path)}
              onPreview={handlePreview}
              onPrefetch={prefetch}
            />
          )}
        </div>
      </main>

      {/* Footer bar */}
      <footer className="border-t border-zinc-800/80 bg-zinc-950 py-2.5 text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-1 font-mono text-[11px]">
          <div>
            <span>Celkem: {stats.folders} složek, {stats.files} souborů</span>
            {stats.files > 0 && <span> ({formatBytes(stats.totalSize)})</span>}
          </div>
          <div className="text-zinc-600">
            FTPS TLS 1.3 • {user?.username}@{user?.host}
          </div>
        </div>
      </footer>

      {/* Preview Modals */}
      <ImagePreviewModal
        isOpen={Boolean(imagePreview)}
        file={imagePreview}
        onClose={() => setImagePreview(null)}
      />

      <AudioPreviewModal
        isOpen={Boolean(audioPreview)}
        file={audioPreview}
        onClose={() => setAudioPreview(null)}
      />

      <VideoPreviewModal
        isOpen={Boolean(videoPreview)}
        file={videoPreview}
        onClose={() => setVideoPreview(null)}
      />

      <PdfPreviewModal
        isOpen={Boolean(pdfPreview)}
        file={pdfPreview}
        onClose={() => setPdfPreview(null)}
      />

      <TextViewerModal
        isOpen={Boolean(textViewerFile)}
        file={textViewerFile}
        onClose={() => setTextViewerFile(null)}
      />
    </div>
  );
}
