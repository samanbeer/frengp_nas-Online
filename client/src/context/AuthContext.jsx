import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serverConfig, setServerConfig] = useState({
    host: 'nas.frengp.cz',
    defaultUser: 'Student',
  });

  // Fetch server public config and check auth state on load
  useEffect(() => {
    async function init() {
      try {
        const configRes = await fetch('/api/auth/config');
        if (configRes.ok) {
          const configData = await configRes.json();
          setServerConfig(configData);
        }
      } catch (err) {
        console.warn('Could not fetch server config:', err);
      }

      try {
        const meRes = await fetch('/api/auth/me');
        if (meRes.ok) {
          const data = await meRes.json();
          if (data.authenticated) {
            setUser(data.user);
          }
        }
      } catch (err) {
        // Not authenticated
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  const login = async (password, username) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password,
        username: username || serverConfig.defaultUser,
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
      await fetch('/api/auth/logout', { method: 'POST' });
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
