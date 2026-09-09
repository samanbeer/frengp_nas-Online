import React from 'react';
import { Film, X, Download } from 'lucide-react';
import { formatBytes } from '../../utils/formatters';

export default function VideoPreviewModal({ isOpen, onClose, file }) {
  if (!isOpen || !file) return null;

  const streamUrl = `/api/files/preview?path=${encodeURIComponent(file.path)}`;
  const downloadUrl = `/api/files/download?path=${encodeURIComponent(file.path)}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-4xl flex items-center justify-between pb-3 text-zinc-200">
        <div className="flex items-center gap-2 truncate">
          <Film className="w-4 h-4 text-zinc-400 flex-shrink-0" />
          <div className="truncate">
            <h3 className="text-xs font-semibold font-mono truncate">{file.name}</h3>
            <p className="text-[10px] text-zinc-500 font-mono">{formatBytes(file.size)}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <a
            href={downloadUrl}
            download
            className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors inline-flex items-center gap-1 text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Stáhnout</span>
          </a>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="w-full max-w-4xl max-h-[80vh] flex items-center justify-center bg-black rounded-xl overflow-hidden shadow-2xl border border-zinc-800">
        <video controls autoPlay className="w-full h-full max-h-[75vh] object-contain">
          <source src={streamUrl} />
          Váš prohlížeč nepodporuje přehrávání tohoto videa.
        </video>
      </div>
    </div>
  );
}
