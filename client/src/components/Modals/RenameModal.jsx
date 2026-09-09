import React, { useState, useEffect } from 'react';
import { Edit3, X, AlertCircle, Loader2 } from 'lucide-react';

export default function RenameModal({ isOpen, onClose, item, onSuccess }) {
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (item) {
      setNewName(item.name);
      setError(null);
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const clean = newName.trim();
    if (!clean) {
      setError('Zadejte nový název.');
      return;
    }
    if (clean === item.name) {
      onClose();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/files/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldPath: item.path,
          newName: clean,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Přejmenování selhalo.');
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
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Edit3 className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-white">
              Přejmenovat {item.isDirectory ? 'složku' : 'soubor'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Nový název
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={loading || !newName.trim()}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white flex items-center gap-2 transition-all cursor-pointer"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Uložit název</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
