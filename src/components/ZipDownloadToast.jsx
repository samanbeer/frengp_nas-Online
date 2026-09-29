import React from 'react';
import {
  FolderArchive,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  FileArchive,
} from 'lucide-react';
import { formatBytes } from '../utils/formatters';

export default function ZipDownloadToast({ state, onCancel, onClose }) {
  if (!state.active) return null;

  const isWorking =
    state.phase === 'scanning' ||
    state.phase === 'downloading' ||
    state.phase === 'compressing';
  const isDone = state.phase === 'done';
  const isError = state.phase === 'error';

  let statusText = '';
  if (state.phase === 'scanning') {
    statusText = 'Prohledávám strukturu podsložek...';
  } else if (state.phase === 'downloading') {
    statusText = state.currentFile
      ? `Stahuji: ${state.currentFile}`
      : 'Stahuji soubory do mezipaměti...';
  } else if (state.phase === 'compressing') {
    statusText = 'Komprimuji data do ZIP archivu...';
  } else if (isDone) {
    statusText = 'Archiv byl úspěšně stažen do počítače.';
  } else if (isError) {
    statusText = state.error || 'Nastala chyba při vytváření archivu.';
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
            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
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
            ) : (
              <FolderArchive className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-zinc-200 truncate flex items-center gap-1.5">
              <span>{state.folderName}.zip</span>
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
              {state.totalFiles > 0
                ? `${state.processedFiles} z ${state.totalFiles} souborů`
                : 'Příprava...'}
            </span>
            <span className="font-semibold text-zinc-300">{state.percent} %</span>
          </div>

          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ease-out rounded-full ${
                isDone
                  ? 'bg-emerald-500'
                  : 'bg-blue-500'
              }`}
              style={{ width: `${Math.max(3, Math.min(100, state.percent))}%` }}
            />
          </div>

          {state.totalBytes > 0 && (
            <div className="flex justify-between text-[10px] font-mono text-zinc-500 pt-0.5">
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
