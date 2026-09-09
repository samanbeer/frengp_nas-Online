import React from 'react';
import { Music, X, Download } from 'lucide-react';
import { formatBytes } from '../../utils/formatters';

export default function AudioPreviewModal({ isOpen, onClose, file }) {
  if (!isOpen || !file) return null;

  const streamUrl = `/api/files/preview?path=${encodeURIComponent(file.path)}`;
  const downloadUrl = `/api/files/download?path=${encodeURIComponent(file.path)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md rounded-xl p-5 border border-zinc-800 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5 truncate">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0 text-zinc-300">
              <Music className="w-4 h-4" />
            </div>
            <div className="truncate">
              <h3 className="text-xs font-semibold text-zinc-200 font-mono truncate">{file.name}</h3>
              <p className="text-[10px] text-zinc-500 font-mono">{formatBytes(file.size)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-5 flex flex-col items-center gap-3">
          <audio controls autoPlay className="w-full rounded-lg">
            <source src={streamUrl} />
            Váš prohlížeč nepodporuje přehrávání audia.
          </audio>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
          <a
            href={downloadUrl}
            download
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 inline-flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Stáhnout</span>
          </a>
        </div>
      </div>
    </div>
  );
}
