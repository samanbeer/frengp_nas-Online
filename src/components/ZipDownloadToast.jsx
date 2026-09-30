import React from 'react';
import {
  FolderArchive,
  FileDown,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import { formatBytes, formatSpeed } from '../utils/formatters';

export default function ZipDownloadToast({ state, onCancel, onClose }) {
  if (!state.active) return null;

  const isWorking =
    state.phase === 'scanning' ||
    state.phase === 'downloading' ||
    state.phase === 'compressing';
  const isDone = state.phase === 'done';
  const isError = state.phase === 'error';
  const isFolder = state.type === 'folder';

  let statusText = '';
  if (state.phase === 'scanning') {
    statusText = 'Prohledávám strukturu podsložek...';
  } else if (state.phase === 'downloading') {
    if (isFolder) {
      statusText = state.currentFile
        ? `Stahuji: ${state.currentFile}`
        : 'Stahuji soubory do mezipaměti...';
    } else {
      statusText = 'Stahování..';
    }
  } else if (state.phase === 'compressing') {
    statusText = 'Komprimuji data do ZIP archivu...';
  } else if (isDone) {
    statusText = isFolder
      ? 'Archiv byl úspěšně připraven a stažen do PC.'
      : 'Soubor byl úspěšně stažen a předán do PC.';
  } else if (isError) {
    statusText = state.error || 'Nastala chyba při stahování.';
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-2rem)] max-w-sm sm:w-[380px] bg-zinc-900/95 backdrop-blur-md border border-zinc-700/80 rounded-xl shadow-2xl p-4 text-zinc-100 transition-all duration-300 animate-in fade-in slide-in-from-bottom-5"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isDone
                ? 'bg-emerald-500/20 text-emerald-400'
                : isError
                ? 'bg-red-500/20 text-red-400'
                : 'bg-blue-500/20 text-blue-400'
            }`}
          >
            {isWorking ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isDone ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : isError ? (
              <AlertCircle className="w-4 h-4" />
            ) : isFolder ? (
              <FolderArchive className="w-4 h-4" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-zinc-200 truncate flex items-center gap-1.5" title={state.name}>
              <span>{state.name}</span>
            </h4>
            <div className="text-[11px] text-zinc-400 truncate mt-0.5" title={statusText}>
              {statusText}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer flex-shrink-0"
          title="Zavřít"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Bar & Details */}
      {!isError && (
        <div className="mt-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
            <span>
              {isFolder
                ? state.totalFiles > 0
                  ? `${state.processedFiles} z ${state.totalFiles} souborů`
                  : 'Příprava...'
                : ''}
            </span>
            <div className="flex items-center gap-2">
              {isWorking && state.speed > 0 && (
                <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded font-mono font-medium">
                  {formatSpeed(state.speed)}
                </span>
              )}
              <span className="font-semibold text-zinc-300">{state.percent} %</span>
            </div>
          </div>

          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-200 ease-out rounded-full ${
                isDone
                  ? 'bg-emerald-500'
                  : 'bg-blue-500'
              }`}
              style={{ width: `${Math.max(3, Math.min(100, state.percent))}%` }}
            />
          </div>

          {state.totalBytes > 0 && (
            <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500 pt-0.5">
              <span>Velikost:</span>
              <span>
                {formatBytes(state.processedBytes)} / {formatBytes(state.totalBytes)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {isWorking && (
        <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex justify-end">
          <button
            onClick={onCancel}
            className="text-[11px] font-medium text-zinc-400 hover:text-red-400 transition-colors cursor-pointer px-2 py-1 rounded hover:bg-zinc-800"
          >
            Zrušit stahování
          </button>
        </div>
      )}
    </div>
  );
}
