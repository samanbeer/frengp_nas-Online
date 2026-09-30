import React from 'react';
import { Download, Eye, FolderDown } from 'lucide-react';
import { getFileCategory } from '../utils/formatters';

export default function FileItemActions({
  item,
  onPreview,
  onDownloadFolder,
  onDownloadFile,
}) {
  if (item.isDirectory) {
    return (
      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        {onDownloadFolder && (
          <button
            onClick={() => onDownloadFolder(item)}
            className="p-1.5 rounded text-zinc-400 hover:text-blue-400 hover:bg-zinc-800 transition-colors cursor-pointer inline-flex items-center"
            title="Stáhnout celou složku jako ZIP"
          >
            <FolderDown className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  const category = getFileCategory(item.name);
  const isPreviewable = ['image', 'video', 'audio', 'pdf', 'code'].includes(category);

  return (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      {/* Preview button */}
      {isPreviewable && (
        <button
          onClick={() => onPreview(item)}
          className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
          title="Zobrazit náhled"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      )}

      {/* In-browser download with progress */}
      <button
        onClick={() => onDownloadFile && onDownloadFile(item)}
        className="p-1.5 rounded text-zinc-400 hover:text-blue-400 hover:bg-zinc-800 transition-colors inline-flex items-center cursor-pointer"
        title="Stáhnout soubor"
      >
        <Download className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

