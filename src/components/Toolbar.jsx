import React from 'react';
import {
  Search,
  LayoutGrid,
  List,
  ArrowDownAZ,
  ArrowUpAZ,
  X,
  FileText,
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
  totalItems = 0,
}) {
  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1">
      {/* Left: Count / Status */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-400 font-mono">
          {totalItems} {totalItems === 1 ? 'položka' : totalItems >= 2 && totalItems <= 4 ? 'položky' : 'položek'}
        </span>
      </div>

      {/* Right: Search & View Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search input */}
        <div className="relative flex-1 sm:w-64">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-zinc-500">
            <Search className="w-3.5 h-3.5" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Hledat ve složce..."
            className="w-full pl-8 pr-7 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-2 flex items-center text-zinc-500 hover:text-zinc-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sort dropdown */}
        <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-transparent text-xs text-zinc-300 px-2 py-1 focus:outline-none cursor-pointer"
          >
            <option value="name" className="bg-zinc-900 text-zinc-200">Podle názvu</option>
            <option value="date" className="bg-zinc-900 text-zinc-200">Podle data</option>
            <option value="size" className="bg-zinc-900 text-zinc-200">Podle velikosti</option>
          </select>

          <button
            onClick={toggleSortOrder}
            title={sortOrder === 'asc' ? 'Vzestupně' : 'Sestupně'}
            className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors cursor-pointer"
          >
            {sortOrder === 'asc' ? (
              <ArrowDownAZ className="w-3.5 h-3.5" />
            ) : (
              <ArrowUpAZ className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* View mode toggle (List vs Grid) */}
        <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('list')}
            title="Seznam (Tabulka)"
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              viewMode === 'list'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            title="Mřížka"
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
