import React from 'react';
import { getFileIcon } from '../utils/fileIcons';
import { formatBytes, getFileCategory } from '../utils/formatters';
import FileItemActions from './FileItemActions';

export default function FileGrid({
  items,
  onNavigate,
  onPreview,
}) {
  const handleItemClick = (item) => {
    if (item.isDirectory) {
      onNavigate(item.path);
    } else {
      const category = getFileCategory(item.name);
      if (['image', 'video', 'audio', 'pdf', 'code'].includes(category)) {
        onPreview(item);
      } else {
        const url = `/api/files/download?path=${encodeURIComponent(item.path)}`;
        window.open(url, '_blank');
      }
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
      {items.map((item) => (
        <div
          key={item.path}
          onClick={() => handleItemClick(item)}
          className="group relative flex flex-col justify-between p-3 rounded-lg bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 transition-colors cursor-pointer select-none"
        >
          {/* Top row */}
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] uppercase font-mono text-zinc-500 truncate">
              {item.isDirectory ? 'Složka' : item.extension || 'Soubor'}
            </span>
            <div onClick={(e) => e.stopPropagation()}>
              <FileItemActions
                item={item}
                onPreview={onPreview}
              />
            </div>
          </div>

          {/* Center icon */}
          <div className="flex-1 flex flex-col items-center justify-center py-3">
            {getFileIcon(item, 'w-8 h-8')}
          </div>

          {/* Bottom info */}
          <div className="mt-1 text-center">
            <div
              className="text-xs font-medium text-zinc-200 truncate group-hover:text-white transition-colors"
              title={item.name}
            >
              {item.name}
            </div>
            <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
              {item.isDirectory ? '-' : formatBytes(item.size)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
