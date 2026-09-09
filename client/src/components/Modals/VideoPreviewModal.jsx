import React from 'react';
import { Film, X, Download } from 'lucide-react';
import { formatBytes } from '../../utils/formatters';

export default function VideoPreviewModal({ isOpen, onClose, file }) {
  if (!isOpen || !file) return null;

  const streamUrl = `/api/files/preview?path=${encodeURIComponent(file.path)}`;
  const downloadUrl = `/api/files/download?path=${encodeURIComponent(file.path)}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-4xl flex items-center justify-between pb-3 text-white">
        <div className="flex items-center gap-2.5 truncate">
          <Film className="w-4 h-4 text-purple-400 flex-shrink-0" />
          <div className="truncate">
            <h3 className="text-sm font-semibold truncate">{file.name}</h3>
            <p className="text-xs text-slate-400">{formatBytes(file.size)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={downloadUrl}
            download
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 text-xs font-medium"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Stáhnout video</span>
          </a>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="w-full max-w-4xl max-h-[80vh] flex items-center justify-center bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10">
        <video controls autoPlay className="w-full h-full max-h-[75vh] object-contain">
          <source src={streamUrl} />
          Váš prohlížeč nepodporuje přehrávání tohoto videa.
        </video>
      </div>
    </div>
  );
}
