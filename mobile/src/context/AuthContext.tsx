import React, { createContext, useContext, useMemo, useState } from 'react';

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

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  setTokenGetter(() => token);

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
      },
      logout: () => {
        setToken(null);
        setUser(null);
      },
    }),
    [token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};
