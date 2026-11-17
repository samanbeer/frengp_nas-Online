import React, { useState, useEffect } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';

const STORAGE_KEY = 'nas_massive_update_2026_seen';
const EXPIRES_AT_MS = new Date('2027-01-01T00:00:00+01:00').getTime();

export default function UpdateAnnouncementModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (Date.now() >= EXPIRES_AT_MS) return;
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) {
        setOpen(true);
      }
    } catch (_) {
      // Ignore storage access errors in restricted contexts
    }
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch (_) {}
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-popup-title"
        className="w-full max-w-sm rounded-xl p-5 border border-zinc-700/80 bg-zinc-900 shadow-2xl text-zinc-100"
      >
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400 flex-shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <h2 id="update-popup-title" className="text-base font-semibold tracking-tight text-zinc-100">
            Masivní Update! :O
          </h2>
        </div>

        <p className="text-xs leading-relaxed text-zinc-300">
          salat.fit teď může naráz využívat moc moc moc lidí naráz! Taky tu je teď interaktivní
          fronta ať v případě přetížení víte, kdy na vás dojde řada!
        </p>

        <button
          type="button"
          onClick={handleDismiss}
          className="w-full mt-4 py-2 px-3 bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
        >
          <span>Kouknout na to</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
