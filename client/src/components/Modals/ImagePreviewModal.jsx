import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Download, Maximize2 } from 'lucide-react';
import { formatBytes } from '../../utils/formatters';

export default function ImagePreviewModal({ isOpen, onClose, file }) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (!isOpen || !file) return null;

  const previewUrl = `/api/files/preview?path=${encodeURIComponent(file.path)}`;
  const downloadUrl = `/api/files/download?path=${encodeURIComponent(file.path)}`;

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.25, 4));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5));
  const handleRotate = () => setRotation((r) => (r + 90) % 360);
  const handleReset = () => {
    setScale(1);
    setRotation(0);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      {/* Top action bar */}
      <div className="w-full max-w-5xl flex items-center justify-between pb-3 text-white">
        <div className="truncate pr-4">
          <h3 className="text-sm font-semibold truncate">{file.name}</h3>
          <p className="text-xs text-slate-400">{formatBytes(file.size)}</p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 p-1 rounded-xl">
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Oddálit"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono px-1.5 text-slate-400">{Math.round(scale * 100)}%</span>
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Přiblížit"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-slate-800 my-auto mx-1" />
          <button
            onClick={handleRotate}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Otočit"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleReset}
            className="px-2 py-1 text-xs rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Resetovat zobrazení"
          >
            100%
          </button>
          <div className="w-px h-4 bg-slate-800 my-auto mx-1" />
          <a
            href={downloadUrl}
            download
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors inline-flex items-center"
            title="Stáhnout obrázek"
          >
            <Download className="w-4 h-4" />
          </a>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
            title="Zavřít (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Image container */}
      <div className="flex-1 w-full max-w-5xl flex items-center justify-center overflow-hidden relative">
        <img
          src={previewUrl}
          alt={file.name}
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg)`,
            transition: 'transform 0.15s ease-out',
          }}
          className="max-h-[80vh] max-w-full object-contain rounded-lg shadow-2xl select-none"
        />
      </div>
    </div>
  );
}
