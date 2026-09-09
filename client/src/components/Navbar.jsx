import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Server, LogOut, RefreshCw, HardDrive, ShieldCheck, Sun, Moon } from 'lucide-react';

export default function Navbar({ onRefresh, refreshing, darkMode, setDarkMode }) {
  const { user, logout, serverConfig } = useAuth();

  return (
    <header className="sticky top-0 z-30 w-full border-b border-white/10 glass-panel">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-cyan-500 flex items-center justify-center shadow-md shadow-brand-500/20">
            <HardDrive className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-white">NAS Cloud</span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <ShieldCheck className="w-3 h-3" />
                FTPS
              </span>
            </div>
            <div className="text-xs text-slate-400 font-mono hidden md:block">
              {serverConfig.host}
            </div>
          </div>
        </div>

        {/* Right: Actions & User profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Refresh button */}
          <button
            onClick={onRefresh}
            disabled={refreshing}
            title="Obnovit soubory"
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-brand-400' : ''}`} />
          </button>

          {/* User info pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-medium text-slate-200">{user?.username || 'Student'}</span>
          </div>

          {/* Logout button */}
          <button
            onClick={logout}
            title="Odhlásit se"
            className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
