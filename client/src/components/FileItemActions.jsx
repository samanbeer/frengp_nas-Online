import React from 'react';
import { Download, Eye } from 'lucide-react';
import { getFileCategory } from '../utils/formatters';

export default function FileItemActions({ item, onPreview }) {
  if (item.isDirectory) {
    return null;
  }

  const category = getFileCategory(item.name);
  const isPreviewable = ['image', 'video', 'audio', 'pdf', 'code'].includes(category);
  const downloadUrl = `/api/files/download?path=${encodeURIComponent(item.path)}`;

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

      {/* Direct download button */}
      <a
        href={downloadUrl}
        download
        className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors inline-flex items-center cursor-pointer"
        title="Stáhnout soubor"
      >
        <Download className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}
