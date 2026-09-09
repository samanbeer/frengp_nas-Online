import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Breadcrumbs from './components/Breadcrumbs';
import Toolbar from './components/Toolbar';
import FileGrid from './components/FileGrid';
import FileList from './components/FileList';
import LoginModal from './components/LoginModal';
import UploadModal from './components/Modals/UploadModal';
import CreateFolderModal from './components/Modals/CreateFolderModal';
import RenameModal from './components/Modals/RenameModal';
import DeleteModal from './components/Modals/DeleteModal';
import ImagePreviewModal from './components/Modals/ImagePreviewModal';
import AudioPreviewModal from './components/Modals/AudioPreviewModal';
import VideoPreviewModal from './components/Modals/VideoPreviewModal';
import PdfPreviewModal from './components/Modals/PdfPreviewModal';
import TextEditorModal from './components/Modals/TextEditorModal';
import { getFileCategory, formatBytes } from './utils/formatters';
import { Loader2, FolderOpen, UploadCloud, AlertCircle } from 'lucide-react';

export default function App() {
  const { user, loading: authLoading } = useAuth();

  // Navigation & Files state
  const [currentPath, setCurrentPath] = useState('/');
  const [items, setItems] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filter & Display controls
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  // Drag & drop on window
  const [isWindowDragActive, setIsWindowDragActive] = useState(false);

  // Modals state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [createFolderModalOpen, setCreateFolderModalOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [audioPreview, setAudioPreview] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [pdfPreview, setPdfPreview] = useState(null);
  const [textEditor, setTextEditor] = useState({ open: false, file: null, isNew: false });

  // Fetch files in directory
  const loadFiles = useCallback(async (targetPath = currentPath, isRefresh = false) => {
    if (!user) return;
    if (isRefresh) setRefreshing(true);
    else setLoadingFiles(true);
    setError(null);

    try {
      const res = await fetch(`/api/files/list?path=${encodeURIComponent(targetPath)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Nepodařilo se načíst soubory.');
      }
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

  // Handle global drag & drop
  useEffect(() => {
    const handleDragOver = (e) => {
      e.preventDefault();
      setIsWindowDragActive(true);
    };
    const handleDragLeave = (e) => {
      e.preventDefault();
      if (e.clientX === 0 && e.clientY === 0) {
        setIsWindowDragActive(false);
      }
    };
    const handleDrop = (e) => {
      e.preventDefault();
      setIsWindowDragActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        setUploadModalOpen(true);
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

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

  // Preview router based on category
  const handlePreview = (item) => {
    const category = getFileCategory(item.name);
    if (category === 'image') setImagePreview(item);
    else if (category === 'audio') setAudioPreview(item);
    else if (category === 'video') setVideoPreview(item);
    else if (category === 'pdf') setPdfPreview(item);
    else if (category === 'code') setTextEditor({ open: true, file: item, isNew: false });
    else {
      // Direct download fallback
      const url = `/api/files/download?path=${encodeURIComponent(item.path)}`;
      window.open(url, '_blank');
    }
  };

  // If still checking auth session
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        <span className="text-sm font-medium">Inicializuji NAS Cloud...</span>
      </div>
    );
  }

  // If not logged in, render the login card
  if (!user) {
    return <LoginModal />;
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col relative text-slate-100 selection:bg-brand-500 selection:text-white">
      {/* Background ambient lighting */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-brand-600/10 rounded-full blur-[160px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[160px] pointer-events-none" />

      {/* Global drag & drop indicator */}
      {isWindowDragActive && (
        <div className="fixed inset-0 z-50 bg-brand-950/80 backdrop-blur-md border-4 border-dashed border-brand-400 flex flex-col items-center justify-center p-8 text-center animate-fadeIn">
          <UploadCloud className="w-16 h-16 text-brand-400 animate-bounce mb-3" />
          <h2 className="text-2xl font-bold text-white mb-1">Přetáhněte soubory sem</h2>
          <p className="text-sm text-brand-300">
            Soubory budou automaticky nahrány do složky <span className="font-mono underline">{currentPath}</span>
          </p>
        </div>
      )}

      {/* Top Navigation */}
      <Navbar
        onRefresh={() => loadFiles(currentPath, true)}
        refreshing={refreshing}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-5">
        {/* Breadcrumb path bar */}
        <Breadcrumbs
          currentPath={currentPath}
          onNavigate={(path) => loadFiles(path)}
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
          onOpenUpload={() => setUploadModalOpen(true)}
          onOpenCreateFolder={() => setCreateFolderModalOpen(true)}
          onOpenCreateFile={() => setTextEditor({ open: true, file: null, isNew: true })}
        />

        {/* Error notification */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Chyba při komunikaci se serverem</div>
              <div className="text-xs text-rose-400/90 mt-0.5">{error}</div>
            </div>
          </div>
        )}

        {/* File Browser Grid or List */}
        <div className="flex-1">
          {loadingFiles ? (
            <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
              <span className="text-sm">Načítám obsah z NAS...</span>
            </div>
          ) : filteredAndSortedItems.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center p-6 rounded-2xl glass-panel border border-slate-800/80">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 flex items-center justify-center text-slate-500 mb-3">
                <FolderOpen className="w-8 h-8" />
              </div>
              <h3 className="text-base font-semibold text-slate-200">
                {searchQuery ? 'Nenalezeny žádné odpovídající položky' : 'Tato složka je prázdná'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                {searchQuery
                  ? 'Zkuste upravit vyhledávací dotaz nebo zrušit filtr.'
                  : 'Nahrajte soubory přetažením sem nebo tlačítkem "Nahrát soubory".'}
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <FileGrid
              items={filteredAndSortedItems}
              onNavigate={(path) => loadFiles(path)}
              onPreview={handlePreview}
              onEdit={(item) => setTextEditor({ open: true, file: item, isNew: false })}
              onRename={(item) => setRenameTarget(item)}
              onDelete={(item) => setDeleteTarget(item)}
            />
          ) : (
            <FileList
              items={filteredAndSortedItems}
              onNavigate={(path) => loadFiles(path)}
              onPreview={handlePreview}
              onEdit={(item) => setTextEditor({ open: true, file: item, isNew: false })}
              onRename={(item) => setRenameTarget(item)}
              onDelete={(item) => setDeleteTarget(item)}
            />
          )}
        </div>
      </main>

      {/* Footer statistics bar */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-3 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <span>Celkem: {stats.folders} složek, {stats.files} souborů</span>
            {stats.files > 0 && <span> ({formatBytes(stats.totalSize)})</span>}
          </div>
          <div className="text-[11px] text-slate-600 font-mono">
            FTPS TLS 1.3 • {user?.username}@{user?.host}
          </div>
        </div>
      </footer>

      {/* Action Modals */}
      <UploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        currentPath={currentPath}
        onUploadSuccess={() => loadFiles(currentPath, true)}
      />

      <CreateFolderModal
        isOpen={createFolderModalOpen}
        onClose={() => setCreateFolderModalOpen(false)}
        currentPath={currentPath}
        onSuccess={() => loadFiles(currentPath, true)}
      />

      <RenameModal
        isOpen={Boolean(renameTarget)}
        item={renameTarget}
        onClose={() => setRenameTarget(null)}
        onSuccess={() => loadFiles(currentPath, true)}
      />

      <DeleteModal
        isOpen={Boolean(deleteTarget)}
        item={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onSuccess={() => loadFiles(currentPath, true)}
      />

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

      <TextEditorModal
        isOpen={textEditor.open}
        file={textEditor.file}
        isNew={textEditor.isNew}
        currentPath={currentPath}
        onClose={() => setTextEditor({ open: false, file: null, isNew: false })}
        onSaveSuccess={() => loadFiles(currentPath, true)}
      />
    </div>
  );
}
