import React from 'react';
import { getFileIcon } from '../utils/fileIcons';
import { formatBytes, formatDate, getFileCategory } from '../utils/formatters';
import FileItemActions from './FileItemActions';

export default function FileList({
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
        const url = `/api/files/download?path=${encodeURIComponent(item.path)}`;
        window.open(url, '_blank');
      }
    }
  };

  return (
    <div className="overflow-x-auto rounded-2xl glass-panel border border-slate-800">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-800/80 bg-slate-900/40 text-slate-400">
            <th className="py-3 px-4 font-medium">Název</th>
            <th className="py-3 px-4 font-medium hidden sm:table-cell">Velikost</th>
            <th className="py-3 px-4 font-medium hidden md:table-cell">Změněno</th>
            <th className="py-3 px-4 font-medium hidden lg:table-cell">Typ</th>
            <th className="py-3 px-4 font-medium text-right">Akce</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/40">
          {items.map((item) => (
            <tr
              key={item.path}
              onClick={() => handleItemClick(item)}
              className="group hover:bg-slate-800/40 transition-colors cursor-pointer"
            >
              {/* Name & Icon */}
              <td className="py-3 px-4 flex items-center gap-3">
                <div className="flex-shrink-0">
                  {getFileIcon(item, 'w-5 h-5')}
                </div>
                <span
                  className="font-medium text-slate-200 group-hover:text-brand-400 transition-colors truncate max-w-xs sm:max-w-md"
                  title={item.name}
                >
                  {item.name}
                </span>
              </td>

              {/* Size */}
              <td className="py-3 px-4 text-slate-400 font-mono hidden sm:table-cell">
                {item.isDirectory ? '-' : formatBytes(item.size)}
              </td>

              {/* Date */}
              <td className="py-3 px-4 text-slate-400 hidden md:table-cell">
                {formatDate(item.modifiedAt)}
              </td>

              {/* Type */}
              <td className="py-3 px-4 text-slate-500 uppercase tracking-wider text-[11px] hidden lg:table-cell">
                {item.isDirectory ? 'Složka' : item.extension || 'Soubor'}
              </td>

              {/* Actions */}
              <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                <FileItemActions
                  item={item}
                  onPreview={onPreview}
                  onEdit={onEdit}
                  onRename={onRename}
                  onDelete={onDelete}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
