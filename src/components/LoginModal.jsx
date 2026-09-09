import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Server, Lock, User, ArrowRight, Loader2, Shield } from 'lucide-react';

export default function LoginModal() {
  const { login, serverConfig } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) {
      setError('Zadejte heslo.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login(password, username.trim());
    } catch (err) {
      setError(err.message || 'Přihlášení se nezdařilo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-zinc-950">
      <div className="w-full max-w-sm">
        {/* Main Card */}
        <div className="enterprise-card rounded-xl p-6 shadow-xl border border-zinc-800 bg-zinc-900/80">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-9 h-9 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-200">
                <Server className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-800/80 border border-zinc-700/60 text-[11px] text-zinc-400 font-mono">
                <Shield className="w-3 h-3 text-emerald-400" />
                <span>FTPS TLS</span>
              </div>
            </div>

            <h1 className="text-lg font-semibold text-zinc-100 tracking-tight">
              NAS Souborový Manažer
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Připojení k úložišti <span className="font-mono text-zinc-300">{serverConfig.host || 'nas.frengp.cz'}</span>
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1 flex-shrink-0" />
              <div className="flex-1 leading-snug">{error}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Username input */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Uživatelské jméno
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-zinc-500">
                  <User className="w-3.5 h-3.5" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Uživatelské jméno"
                  autoComplete="username"
                  autoFocus
                  className="w-full pl-8 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-xs placeholder-zinc-500 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-colors"
                />
              </div>
            </div>

            {/* Password input */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Heslo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-zinc-500">
                  <Lock className="w-3.5 h-3.5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Heslo"
                  autoComplete="current-password"
                  className="w-full pl-8 pr-8 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-xs placeholder-zinc-500 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors text-[11px]"
                >
                  {showPassword ? 'Skrýt' : 'Zobrazit'}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2 px-3 bg-zinc-100 hover:bg-white disabled:opacity-50 text-zinc-950 font-medium text-xs rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Ověřuji spojení...</span>
                </>
              ) : (
                <>
                  <span>Přihlásit se</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Footer note */}
          <div className="mt-5 pt-4 border-t border-zinc-800 text-center">
            <p className="text-[11px] text-zinc-500 font-mono">
              Šifrovaný přenos přes FTPS (Port 21)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
