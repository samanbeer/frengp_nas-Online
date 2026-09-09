import React from 'react';
import { getFileIcon } from '../utils/fileIcons';
import { formatBytes, formatDate, getFileCategory } from '../utils/formatters';
import FileItemActions from './FileItemActions';

export default function FileGrid({
  items,
  onNavigate,
  onPreview,
  onEdit,
  onRename,
  onDelete,
}) {
  const handleItemClick = (item) => {
    if (item.isDirectory) {
      onNavigate(item.path);
    } else {
      const category = getFileCategory(item.name);
      if (['image', 'video', 'audio', 'pdf', 'code'].includes(category)) {
        onPreview(item);
      } else {
        // Direct download
        const url = `/api/files/download?path=${encodeURIComponent(item.path)}`;
        window.open(url, '_blank');
      }
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
      {items.map((item) => (
        <div
          key={item.path}
          onClick={() => handleItemClick(item)}
          className="group relative flex flex-col justify-between p-3.5 rounded-2xl glass-card cursor-pointer"
        >
          {/* Top row: item type tag / actions */}
          <div className="flex items-center justify-between gap-1 mb-2">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 truncate">
              {item.isDirectory ? 'Složka' : item.extension || 'Soubor'}
            </span>
            <div onClick={(e) => e.stopPropagation()}>
              <FileItemActions
                item={item}
                onPreview={onPreview}
                onEdit={onEdit}
                onRename={onRename}
                onDelete={onDelete}
              />
            </div>
          </div>

          {/* Center icon / thumbnail preview */}
          <div className="flex-1 flex flex-col items-center justify-center py-4 group-hover:scale-105 transition-transform duration-200">
            {getFileIcon(item, 'w-12 h-12')}
          </div>

          {/* Bottom info */}
          <div className="mt-2 text-center">
            <div
              className="text-xs font-medium text-slate-200 truncate group-hover:text-brand-400 transition-colors"
              title={item.name}
            >
              {item.name}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {item.isDirectory ? '-' : formatBytes(item.size)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
