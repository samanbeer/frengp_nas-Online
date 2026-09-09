import React from 'react';
import { ChevronRight, Home, ArrowLeft, Copy, Check } from 'lucide-react';

export default function Breadcrumbs({ currentPath, onNavigate }) {
  const [copied, setCopied] = React.useState(false);

  // Split path into segments
  // e.g. "/Vyuka/Notebooky" -> ["Vyuka", "Notebooky"]
  const segments = currentPath === '/' ? [] : currentPath.split('/').filter(Boolean);

  const handleCopy = () => {
    navigator.clipboard.writeText(currentPath);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const navigateToSegment = (index) => {
    if (index === -1) {
      onNavigate('/');
      return;
    }
    const path = '/' + segments.slice(0, index + 1).join('/');
    onNavigate(path);
  };

  const navigateUp = () => {
    if (segments.length <= 1) {
      onNavigate('/');
    } else {
      const parent = '/' + segments.slice(0, -1).join('/');
      onNavigate(parent);
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 py-3 px-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-sm">
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {/* Back button if not in root */}
        {currentPath !== '/' && (
          <button
            onClick={navigateUp}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors mr-1 cursor-pointer"
            title="O úroveň výše"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}

        {/* Root Home button */}
        <button
          onClick={() => onNavigate('/')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
            currentPath === '/'
              ? 'text-brand-400 bg-brand-500/10 font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Home className="w-4 h-4" />
          <span>Kořen</span>
        </button>

        {/* Segments */}
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          return (
            <React.Fragment key={index}>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
              <button
                onClick={() => navigateToSegment(index)}
                className={`px-2.5 py-1 rounded-lg transition-colors truncate max-w-[160px] cursor-pointer ${
                  isLast
                    ? 'text-brand-400 bg-brand-500/10 font-medium'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
                title={segment}
              >
                {segment}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Copy path button */}
      <button
        onClick={handleCopy}
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors flex-shrink-0 cursor-pointer"
        title="Kopírovat cestu"
      >
        {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}
