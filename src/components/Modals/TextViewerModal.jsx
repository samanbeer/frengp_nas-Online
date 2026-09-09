import React, { useState, useEffect } from 'react';
import { FileText, X, Download, Copy, Check, Loader2, AlertCircle } from 'lucide-react';
import { formatBytes } from '../../utils/formatters';

export default function TextViewerModal({ isOpen, onClose, file }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !file) return;

    setLoading(true);
    setError(null);
    fetch(`/api/files/read-text?path=${encodeURIComponent(file.path)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Nepodařilo se načíst soubor.');
        setContent(data.content);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [isOpen, file]);

  if (!isOpen || !file) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lineCount = content ? content.split('\n').length : 0;
  const downloadUrl = `/api/files/download?path=${encodeURIComponent(file.path)}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-4xl h-[85vh] rounded-xl flex flex-col border border-zinc-800 bg-zinc-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center gap-2.5 truncate">
            <FileText className="w-4 h-4 text-zinc-400 flex-shrink-0" />
            <div className="truncate">
              <h3 className="text-xs font-semibold text-zinc-200 font-mono truncate">{file.name}</h3>
              <p className="text-[10px] text-zinc-500 font-mono">
                {formatBytes(file.size)} • {lineCount} řádků • Pouze pro čtení
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopy}
              disabled={loading || !content}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 border border-zinc-700/60 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Kopírovat text"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Zkopírováno' : 'Kopírovat'}</span>
            </button>

            <a
              href={downloadUrl}
              download
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 border border-zinc-700/60 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Stáhnout soubor"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Stáhnout</span>
            </a>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Error notification */}
        {error && (
          <div className="m-4 p-3 rounded-lg bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Viewer content */}
        <div className="flex-1 overflow-auto p-4 bg-zinc-950 text-zinc-200 font-mono text-xs leading-relaxed selection:bg-zinc-700 selection:text-white">
          {loading ? (
            <div className="h-full flex items-center justify-center text-zinc-500 gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
              <span>Načítám text ze serveru...</span>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap break-words font-mono text-zinc-300">
              {content || '(Prázdný soubor)'}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
          <span>UTF-8</span>
          <span className="truncate max-w-md">{file.path}</span>
        </div>
      </div>
    </div>
  );
}
