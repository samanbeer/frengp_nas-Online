import React, { useState, useEffect } from 'react';
import { FileCode, X, Save, Download, Loader2, AlertCircle, Check } from 'lucide-react';
import { formatBytes } from '../../utils/formatters';

export default function TextEditorModal({ isOpen, onClose, file, currentPath, isNew = false, onSaveSuccess }) {
  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    if (isNew) {
      setContent('');
      setFileName('novy-soubor.txt');
      setError(null);
      return;
    }

    if (file) {
      setFileName(file.name);
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
    }
  }, [isOpen, file, isNew]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    const targetPath = isNew
      ? (currentPath === '/' ? `/${fileName}` : `${currentPath}/${fileName}`)
      : file.path;

    try {
      const res = await fetch('/api/files/write-text', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: targetPath,
          content,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Uložení souboru selhalo.');
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      if (onSaveSuccess) onSaveSuccess();
      if (isNew) onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const lineCount = content.split('\n').length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-5xl h-[85vh] glass-panel rounded-2xl flex flex-col border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-white/10 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <FileCode className="w-4 h-4" />
            </div>
            {isNew ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Název:</span>
                <input
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            ) : (
              <div>
                <h3 className="text-sm font-bold text-white font-mono">{file?.name}</h3>
                <p className="text-xs text-slate-400">
                  {file?.size ? formatBytes(file.size) : ''} • {lineCount} řádků
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="px-3.5 py-1.5 rounded-xl text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-600/20"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : saved ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{saved ? 'Uloženo!' : 'Uložit soubor'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error notification */}
        {error && (
          <div className="m-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Editor body */}
        <div className="flex-1 flex overflow-hidden relative bg-slate-950/80">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
              <span className="text-sm">Načítám obsah ze serveru...</span>
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={false}
              placeholder="Zde napište nebo vložte text..."
              className="w-full h-full p-4 bg-transparent text-slate-200 font-mono text-xs sm:text-sm resize-none focus:outline-none leading-relaxed selection:bg-brand-500 selection:text-white"
            />
          )}
        </div>

        {/* Footer info */}
        <div className="px-6 py-2 border-t border-white/10 bg-slate-900/60 flex items-center justify-between text-xs text-slate-500 font-mono">
          <span>UTF-8 • {content.length} znaků</span>
          <span>{isNew ? currentPath : file?.path}</span>
        </div>
      </div>
    </div>
  );
}
