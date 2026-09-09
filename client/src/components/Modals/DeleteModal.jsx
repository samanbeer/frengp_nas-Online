import React, { useState } from 'react';
import { Trash2, X, AlertTriangle, Loader2 } from 'lucide-react';

export default function DeleteModal({ isOpen, onClose, item, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !item) return null;

  const handleDelete = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/files/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: item.path,
          isDirectory: item.isDirectory,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Smazání položky selhalo.');
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md glass-panel rounded-2xl p-6 border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <Trash2 className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-white">Potvrdit smazání</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-200 text-xs leading-relaxed">
            <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              Opravdu si přejete smazat položku{' '}
              <span className="font-semibold text-white break-all">{item.name}</span>?
              {item.isDirectory && ' Celý obsah této složky bude trvale odstraněn.'}
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              {error}
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Zrušit
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-medium bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-rose-600/25"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Smazat</span>
          </button>
        </div>
      </div>
    </div>
  );
}
