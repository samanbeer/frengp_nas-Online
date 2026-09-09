import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Download } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fadeIn">
      {/* Top action bar */}
      <div className="w-full max-w-5xl flex items-center justify-between pb-3 text-zinc-200">
        <div className="truncate pr-4">
          <h3 className="text-xs font-semibold font-mono truncate">{file.name}</h3>
          <p className="text-[11px] text-zinc-500 font-mono">{formatBytes(file.size)}</p>
        </div>

        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-lg">
          <button
            onClick={handleZoomOut}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            title="Oddálit"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-mono px-1.5 text-zinc-400">{Math.round(scale * 100)}%</span>
          <button
            onClick={handleZoomIn}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            title="Přiblížit"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-3.5 bg-zinc-800 my-auto mx-1" />
          <button
            onClick={handleRotate}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            title="Otočit"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleReset}
            className="px-1.5 py-0.5 text-xs rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            title="Resetovat"
          >
            100%
          </button>
          <div className="w-px h-3.5 bg-zinc-800 my-auto mx-1" />
          <a
            href={downloadUrl}
            download
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors inline-flex items-center"
            title="Stáhnout obrázek"
          >
            <Download className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors ml-1"
            title="Zavřít"
          >
            <X className="w-3.5 h-3.5" />
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
          className="max-h-[82vh] max-w-full object-contain rounded border border-zinc-800/80 shadow-2xl select-none"
        />
      </div>
    </div>
  );
}
