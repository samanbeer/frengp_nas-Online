import React, { useState, useRef } from 'react';
import { UploadCloud, X, File, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { formatBytes } from '../../utils/formatters';

export default function UploadModal({ isOpen, onClose, currentPath, onUploadSuccess }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFiles = (files) => {
    const fileList = Array.from(files);
    setSelectedFiles(fileList);
    setError(null);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setError(null);
    setProgress(10);

    const formData = new FormData();
    selectedFiles.forEach((file) => {
      formData.append('files', file);
    });

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/files/upload?path=${encodeURIComponent(currentPath)}`, true);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setProgress(100);
          setTimeout(() => {
            onUploadSuccess();
            onClose();
            setSelectedFiles([]);
            setUploading(false);
            setProgress(0);
          }, 600);
        } else {
          try {
            const res = JSON.parse(xhr.responseText);
            setError(res.error || 'Nahrávání selhalo.');
          } catch (e) {
            setError('Nahrávání selhalo.');
          }
          setUploading(false);
        }
      };

      xhr.onerror = () => {
        setError('Došlo k síťové chybě při nahrávání.');
        setUploading(false);
      };

      xhr.send(formData);
    } catch (err) {
      setError(err.message || 'Chyba nahrávání');
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg glass-panel rounded-2xl p-6 border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h3 className="text-lg font-bold text-white">Nahrát soubory</h3>
            <p className="text-xs text-slate-400">
              Cíl: <span className="text-brand-400 font-mono">{currentPath}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drop zone */}
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`mt-4 border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            dragActive
              ? 'border-brand-500 bg-brand-500/10'
              : 'border-slate-700 hover:border-brand-500/50 bg-slate-900/40'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-brand-500/10 text-brand-400 flex items-center justify-center">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div className="text-sm font-medium text-slate-200">
              Přetáhněte soubory sem nebo <span className="text-brand-400 underline">vyberte ze zařízení</span>
            </div>
            <div className="text-xs text-slate-500">
              Podporovány jsou jakékoli typy souborů do 2 GB
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* File preview list */}
        {selectedFiles.length > 0 && (
          <div className="mt-4 max-h-48 overflow-y-auto space-y-2 pr-1">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Vybrané soubory ({selectedFiles.length})
            </div>
            {selectedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-900/70 border border-slate-800 text-xs text-slate-300"
              >
                <div className="flex items-center gap-2 truncate">
                  <File className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="truncate">{file.name}</span>
                </div>
                <span className="text-slate-500 flex-shrink-0 ml-2">{formatBytes(file.size)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Progress bar */}
        {uploading && (
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Nahrávám na FTPS server...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-600 to-cyan-500 transition-all duration-300 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-white/10">
          <button
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Zrušit
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading || selectedFiles.length === 0}
            className="px-5 py-2 rounded-xl text-xs font-medium bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white shadow-lg shadow-brand-500/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            {uploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Nahrávám...</span>
              </>
            ) : (
              <span>Nahrát {selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
