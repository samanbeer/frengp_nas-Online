import React from 'react';
import { ChevronRight, Folder, ArrowLeft, Copy, Check } from 'lucide-react';

export default function Breadcrumbs({ currentPath, onNavigate, onPrefetch }) {
  const [copied, setCopied] = React.useState(false);

  const segments = currentPath === '/' ? [] : currentPath.split('/').filter(Boolean);

  const handleCopy = () => {
    navigator.clipboard.writeText(currentPath);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getSegmentPath = (index) => {
    if (index === -1) return '/';
    return '/' + segments.slice(0, index + 1).join('/');
  };

  const navigateToSegment = (index) => {
    onNavigate(getSegmentPath(index));
  };

  const getParentPath = () => {
    if (segments.length <= 1) return '/';
    return '/' + segments.slice(0, -1).join('/');
  };

  const navigateUp = () => {
    onNavigate(getParentPath());
  };

  return (
    <div className="flex items-center justify-between gap-2 py-2 px-3.5 rounded-lg bg-zinc-900/70 border border-zinc-800 text-xs">
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
        {/* Back button if not in root */}
        {currentPath !== '/' && (
          <button
            onClick={navigateUp}
            onMouseEnter={() => onPrefetch && onPrefetch(getParentPath())}
            className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors mr-1 cursor-pointer"
            title="O úroveň výše"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Root button */}
        <button
          onClick={() => onNavigate('/')}
          onMouseEnter={() => onPrefetch && onPrefetch('/')}
          className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors font-mono cursor-pointer ${
            currentPath === '/'
              ? 'text-zinc-100 bg-zinc-800 font-medium'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
          }`}
        >
          <Folder className="w-3.5 h-3.5" />
          <span>/</span>
        </button>

        {/* Segments */}
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          const segPath = getSegmentPath(index);
          return (
            <React.Fragment key={index}>
              <ChevronRight className="w-3 h-3 text-zinc-600 flex-shrink-0" />
              <button
                onClick={() => navigateToSegment(index)}
                onMouseEnter={() => !isLast && onPrefetch && onPrefetch(segPath)}
                className={`px-2 py-1 rounded transition-colors truncate max-w-[200px] font-mono cursor-pointer ${
                  isLast
                    ? 'text-zinc-100 bg-zinc-800 font-medium'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
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
        className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors flex-shrink-0 cursor-pointer"
        title="Kopírovat cestu"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
