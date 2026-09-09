import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serverConfig, setServerConfig] = useState({
    host: 'nas.frengp.cz',
    port: 21,
    hasDefaultUser: false,
  });

  // Fetch server public config and check auth state on load
  useEffect(() => {
    async function init() {
      try {
        const configRes = await fetch('/api/auth/config', { cache: 'no-store' });
        if (configRes.ok) {
          const configData = await configRes.json();
          setServerConfig(configData);
        }
      } catch (err) {
        console.warn('Could not fetch server config:', err);
      }

      try {
        const meRes = await fetch('/api/auth/me', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (meRes.ok) {
          const data = await meRes.json();
          if (data.authenticated) {
            setUser(data.user);
          } else {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch (err) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  const login = async (password, username) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password,
        username: (username && username.trim()) || undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Přihlášení se nezdařilo.');
    }

    setUser(data.user);
    return data;
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, serverConfig, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
