import React from 'react';
import { getFileIcon } from '../utils/fileIcons';
import { formatBytes, formatDate, getFileCategory } from '../utils/formatters';
import FileItemActions from './FileItemActions';
import { Folder } from 'lucide-react';

export default function FileList({
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
    <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/40">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/90 text-zinc-400 font-medium">
            <th className="py-2.5 px-3.5 w-1/2">Název</th>
            <th className="py-2.5 px-3.5 hidden sm:table-cell w-28">Velikost</th>
            <th className="py-2.5 px-3.5 hidden md:table-cell w-44">Datum úpravy</th>
            <th className="py-2.5 px-3.5 hidden lg:table-cell w-24">Typ</th>
            <th className="py-2.5 px-3.5 text-right w-20">Akce</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/60">
          {items.map((item) => (
            <tr
              key={item.path}
              onClick={() => handleItemClick(item)}
              className="group hover:bg-zinc-800/40 transition-colors cursor-pointer select-none"
            >
              {/* Name & Icon */}
              <td className="py-2.5 px-3.5 flex items-center gap-2.5">
                <div className="flex-shrink-0">
                  {getFileIcon(item, 'w-4 h-4')}
                </div>
                <span
                  className="font-medium text-zinc-200 group-hover:text-white transition-colors truncate max-w-sm sm:max-w-md lg:max-w-lg"
                  title={item.name}
                >
                  {item.name}
                </span>
              </td>

              {/* Size */}
              <td className="py-2.5 px-3.5 text-zinc-400 font-mono hidden sm:table-cell">
                {item.isDirectory ? '-' : formatBytes(item.size)}
              </td>

              {/* Date */}
              <td className="py-2.5 px-3.5 text-zinc-400 font-mono hidden md:table-cell">
                {formatDate(item.modifiedAt)}
              </td>

              {/* Type */}
              <td className="py-2.5 px-3.5 text-zinc-500 uppercase tracking-wider text-[10px] font-mono hidden lg:table-cell">
                {item.isDirectory ? 'Složka' : item.extension || 'Soubor'}
              </td>

              {/* Actions */}
              <td className="py-2.5 px-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                <FileItemActions
                  item={item}
                  onPreview={onPreview}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
