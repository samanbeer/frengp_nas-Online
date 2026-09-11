import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Server, LogOut, RefreshCw, Shield, Lock } from 'lucide-react';

export default function Navbar({ onRefresh, refreshing, connectionTtl }) {
  const { user, logout, serverConfig } = useAuth();

  return (
    <header className="sticky top-0 z-30 w-full border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Left: Brand & Badges */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700/80 flex items-center justify-center text-zinc-200">
            <Server className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm tracking-tight text-zinc-100">NAS Storage</span>
            <span className="text-zinc-500 text-xs hidden sm:inline">•</span>
            <span className="text-xs font-mono text-zinc-400 hidden sm:inline">{serverConfig.host}</span>
          </div>

          {/* Read Only Status Pill */}
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900/60 text-[11px] font-medium text-zinc-400">
            <Lock className="w-3 h-3 text-zinc-400" />
            <span>POUZE PRO ČTENÍ</span>
          </div>
        </div>

        {/* Right: Actions & User profile */}
        <div className="flex items-center gap-2">
          {/* TTL Countdown */}
          {connectionTtl !== undefined && (
            <div
              title={
                connectionTtl > 0
                  ? `Spojení k NAS serveru je aktivní. Po ${connectionTtl} s nečinnosti se automaticky odpojí.`
                  : 'Spojení k NAS serveru je odpojeno (neaktivní). Další akce se znovu připojí.'
              }
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-900/90 border border-zinc-800 text-xs font-mono select-none"
            >
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  connectionTtl > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'
                }`}
              />
              <span className={connectionTtl > 0 ? 'text-zinc-300' : 'text-zinc-500'}>
                TTL: {connectionTtl}s
              </span>
            </div>
          )}

          {/* Refresh button */}
          <button
            onClick={onRefresh}
            disabled={refreshing}
            title="Obnovit seznam souborů"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-zinc-200' : ''}`} />
          </button>

          {/* User info */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 font-mono">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>{user?.username || 'Uživatel'}</span>
          </div>

          {/* Logout button */}
          <button
            onClick={logout}
            title="Odhlásit se"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-950/20 border border-zinc-800 hover:border-red-900/50 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
