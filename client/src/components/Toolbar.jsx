import React from 'react';
import {
  Upload,
  FolderPlus,
  FilePlus,
  Search,
  LayoutGrid,
  List,
  ArrowDownAZ,
  ArrowUpAZ,
  Calendar,
  HardDriveDownload,
  X,
} from 'lucide-react';

export default function Toolbar({
  searchQuery,
  setSearchQuery,
  viewMode,
  setViewMode,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  onOpenUpload,
  onOpenCreateFolder,
  onOpenCreateFile,
}) {
  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
      {/* Action buttons (Left) */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={onOpenUpload}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium shadow-md shadow-brand-600/20 transition-all cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          <span>Nahrát soubory</span>
        </button>

        <button
          onClick={onOpenCreateFolder}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 text-sm font-medium transition-all cursor-pointer"
        >
          <FolderPlus className="w-4 h-4 text-amber-400" />
          <span>Nová složka</span>
        </button>

        <button
          onClick={onOpenCreateFile}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 text-sm font-medium transition-all cursor-pointer"
        >
          <FilePlus className="w-4 h-4 text-emerald-400" />
          <span>Nový text</span>
        </button>
      </div>

      {/* Search & View Controls (Right) */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* Search input */}
        <div className="relative flex-1 md:w-56">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Search className="w-3.5 h-3.5" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Hledat v této složce..."
            className="w-full pl-9 pr-8 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sort dropdown */}
        <div className="flex items-center bg-slate-900/80 border border-slate-800 rounded-xl p-0.5">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-transparent text-xs text-slate-300 px-2.5 py-1.5 focus:outline-none cursor-pointer"
          >
            <option value="name" className="bg-slate-900 text-slate-200">Podle názvu</option>
            <option value="date" className="bg-slate-900 text-slate-200">Podle data</option>
            <option value="size" className="bg-slate-900 text-slate-200">Podle velikosti</option>
          </select>

          <button
            onClick={toggleSortOrder}
            title={sortOrder === 'asc' ? 'Vzestupně' : 'Sestupně'}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            {sortOrder === 'asc' ? (
              <ArrowDownAZ className="w-3.5 h-3.5" />
            ) : (
              <ArrowUpAZ className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* View mode toggle (Grid vs List) */}
        <div className="flex items-center bg-slate-900/80 border border-slate-800 rounded-xl p-0.5">
          <button
            onClick={() => setViewMode('grid')}
            title="Mřížka"
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            title="Seznam"
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              viewMode === 'list'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
