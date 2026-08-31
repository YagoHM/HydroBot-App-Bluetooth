import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

export const AUTH_KEY = '@hydrobot_authenticated';

interface AuthContextType {
  isAuthenticated: boolean | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(AUTH_KEY)
      .then((val) => {
        setIsAuthenticated(val === 'true');
      })
      .catch((err) => {
        console.error('Falha ao ler estado de autenticação:', err);
        setIsAuthenticated(false);
      });
  }, []);

  const login = async () => {
    await AsyncStorage.setItem(AUTH_KEY, 'true');
    setIsAuthenticated(true);
  };

  const logout = async () => {
    await AsyncStorage.removeItem(AUTH_KEY);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
