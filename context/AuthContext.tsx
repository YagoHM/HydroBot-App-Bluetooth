import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

export interface RegisteredUser {
  name: string;
  email: string;
  password: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  findUser: (email: string, password: string) => RegisteredUser | undefined;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const USERS_STORAGE_KEY = '@hydrobot/registered_users';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [users, setUsers] = useState<RegisteredUser[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(USERS_STORAGE_KEY).then((stored) => {
      if (stored) {
        setUsers(JSON.parse(stored));
      }
    });
  }, []);

  const login = async () => {
    setIsAuthenticated(true);
  };

  const logout = async () => {
    setIsAuthenticated(false);
  };

  const register = async (name: string, email: string, password: string) => {
    const updatedUsers = [...users.filter((u) => u.email !== email), { name, email, password }];
    setUsers(updatedUsers);
    await AsyncStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedUsers));
  };

  const findUser = (email: string, password: string) => {
    return users.find((u) => u.email === email && u.password === password);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, register, findUser }}>
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
