import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialised, setInitialised] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { initialised } = await api.get('/auth/status');
      setInitialised(initialised);
      if (!initialised) {
        setUser(null);
        return;
      }
      const { user } = await api.get('/auth/me');
      setUser(user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (username, password) => {
    const { user } = await api.post('/auth/login', { username, password });
    setUser(user);
    return user;
  };

  const setup = async (name, username, password) => {
    const { user } = await api.post('/auth/setup', { name, username, password });
    setInitialised(true);
    setUser(user);
    return user;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignore */
    }
    setUser(null);
  };

  // Called after a successful password change to refresh the must-change flag.
  const applyUser = (u) => setUser(u);

  return (
    <AuthContext.Provider
      value={{ user, loading, initialised, login, setup, logout, refresh, applyUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
