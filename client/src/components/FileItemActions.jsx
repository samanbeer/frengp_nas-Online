import React, { useState, useRef, useEffect } from 'react';
import {
  MoreVertical,
  Download,
  Eye,
  Edit,
  Trash2,
  Edit3,
} from 'lucide-react';
import { getFileCategory } from '../utils/formatters';

export default function FileItemActions({
  item,
  onPreview,
  onEdit,
  onRename,
  onDelete,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const category = getFileCategory(item.name);
  const isPreviewable = ['image', 'video', 'audio', 'pdf', 'code'].includes(category);
  const isEditable = category === 'code';
  const downloadUrl = `/api/files/download?path=${encodeURIComponent(item.path)}`;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen(!menuOpen);
        }}
        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        title="Další akce"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {menuOpen && (
        <div
          className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-slate-900 border border-slate-700/80 shadow-2xl z-40 py-1 text-xs text-slate-200 animate-fadeIn"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Preview action */}
          {!item.isDirectory && isPreviewable && (
            <button
              onClick={() => {
                setMenuOpen(false);
                onPreview(item);
              }}
              className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-brand-400" />
              <span>Náhled</span>
            </button>
          )}

          {/* Edit text file */}
          {!item.isDirectory && isEditable && (
            <button
              onClick={() => {
                setMenuOpen(false);
                onEdit(item);
              }}
              className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            >
              <Edit className="w-3.5 h-3.5 text-emerald-400" />
              <span>Upravit text</span>
            </button>
          )}

          {/* Download file */}
          {!item.isDirectory && (
            <a
              href={downloadUrl}
              download
              onClick={() => setMenuOpen(false)}
              className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span>Stáhnout</span>
            </a>
          )}

          {/* Rename item */}
          <button
            onClick={() => {
              setMenuOpen(false);
              onRename(item);
            }}
            className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-amber-400" />
            <span>Přejmenovat</span>
          </button>

          <div className="h-px bg-slate-800 my-1" />

          {/* Delete item */}
          <button
            onClick={() => {
              setMenuOpen(false);
              onDelete(item);
            }}
            className="w-full px-3 py-2 text-left flex items-center gap-2 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Smazat</span>
          </button>
        </div>
      )}
    </div>
  );
}
