import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { login as loginRequest, setTokenGetter } from '../services/api';
import type { AuthUser } from '../types/inspection';

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  login: (employeeId: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const DEVICE_ID = 'expo-device';
const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_USER_KEY = 'auth_user';

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    setTokenGetter(() => token);
  }, [token]);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const [storedToken, storedUser] = await Promise.all([
          AsyncStorage.getItem(AUTH_TOKEN_KEY),
          AsyncStorage.getItem(AUTH_USER_KEY),
        ]);

        if (storedToken) {
          setToken(storedToken);
        }

        if (storedUser) {
          setUser(JSON.parse(storedUser) as AuthUser);
        }
      } finally {
        setIsInitialized(true);
      }
    };

    void restoreSession();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      login: async (employeeId: string, password: string) => {
        const response = await loginRequest({
          employeeId,
          password,
          deviceId: DEVICE_ID,
        });

        setToken(response.token);
        setUser(response.user);
        await AsyncStorage.multiSet([
          [AUTH_TOKEN_KEY, response.token],
          [AUTH_USER_KEY, JSON.stringify(response.user)],
        ]);
      },
      logout: () => {
        setToken(null);
        setUser(null);
        void AsyncStorage.multiRemove([AUTH_TOKEN_KEY, AUTH_USER_KEY]);
      },
    }),
    [token, user],
  );

  if (!isInitialized) {
    return null;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};
