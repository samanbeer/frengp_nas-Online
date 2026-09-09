import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Server, Lock, ShieldCheck, Eye, EyeOff, KeyRound, User, ArrowRight, Loader2 } from 'lucide-react';

export default function LoginModal() {
  const { login, serverConfig } = useAuth();
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState(serverConfig.defaultUser || 'Student');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) {
      setError('Zadejte prosím heslo.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login(password, username);
    } catch (err) {
      setError(err.message || 'Chyba při přihlašování.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden bg-slate-950">
      {/* Dynamic background ambient lights */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Main Card */}
        <div className="glass-panel rounded-3xl p-8 shadow-2xl border border-white/10 backdrop-blur-2xl">
          {/* Logo & Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-cyan-500 shadow-lg shadow-brand-500/25 mb-4 ring-4 ring-brand-500/20">
              <Server className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              NAS Cloud
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Správce souborů pro <span className="text-brand-400 font-medium">nas.saman.beer</span>
            </p>
          </div>

          {/* Connection Target Badge */}
          <div className="mb-6 px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-mono text-slate-300">{serverConfig.host || 'nas.frengp.cz'}</span>
            </div>
            <div className="flex items-center gap-1 text-emerald-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>FTPS (TLS)</span>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-start gap-2.5 animate-fadeIn">
              <div className="w-2 h-2 rounded-full bg-rose-400 mt-1.5 flex-shrink-0" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Active user display or input */}
            {!showAdvanced ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-sm">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-400">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Přihlášení jako</div>
                    <div className="font-medium text-slate-200">{username}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(true)}
                  className="text-xs text-brand-400 hover:text-brand-300 font-medium px-2 py-1 rounded hover:bg-brand-500/10 transition-colors"
                >
                  Změnit
                </button>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Uživatelské jméno
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                    placeholder="Např. Student"
                  />
                </div>
              </div>
            )}

            {/* Password input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Heslo k úložišti
                </label>
                <span className="text-xs text-slate-500">Pouze heslo</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  required
                  placeholder="Zadejte heslo..."
                  className="w-full pl-10 pr-10 py-3 bg-slate-900/80 border border-slate-700/80 rounded-xl text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 disabled:opacity-50 text-white font-medium text-sm rounded-xl shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Připojuji k FTPS serveru...</span>
                </>
              ) : (
                <>
                  <span>Odemknout a vstoupit</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer note */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
            <p className="text-xs text-slate-500">
              Přístup přes zabezpečený protokol FTPS s TLS šifrováním.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
