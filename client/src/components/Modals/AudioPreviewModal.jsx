import React from 'react';
import { Music, X, Download } from 'lucide-react';
import { formatBytes } from '../../utils/formatters';

export default function AudioPreviewModal({ isOpen, onClose, file }) {
  if (!isOpen || !file) return null;

  const streamUrl = `/api/files/preview?path=${encodeURIComponent(file.path)}`;
  const downloadUrl = `/api/files/download?path=${encodeURIComponent(file.path)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md glass-panel rounded-2xl p-6 border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3 truncate">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center flex-shrink-0">
              <Music className="w-5 h-5" />
            </div>
            <div className="truncate">
              <h3 className="text-sm font-bold text-white truncate">{file.name}</h3>
              <p className="text-xs text-slate-400">{formatBytes(file.size)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-6 flex flex-col items-center gap-4">
          <audio controls autoPlay className="w-full rounded-xl">
            <source src={streamUrl} />
            Váš prohlížeč nepodporuje přehrávání audia.
          </audio>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-white/10">
          <a
            href={downloadUrl}
            download
            className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 inline-flex items-center gap-2 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Stáhnout skladbu</span>
          </a>
        </div>
      </div>
    </div>
  );
}
