export type UserRole =
  | 'WORKER'
  | 'SUPERVISOR'
  | 'SENIOR_SUPERVISOR'
  | 'ADMIN'
  | 'AUDITOR';

export interface AuthUser {
  id: string;
  role: UserRole;
}

export const AUTH_TOKEN_KEY = 'rail_web_token';
export const AUTH_USER_KEY = 'rail_web_user';
export const WEB_DEVICE_ID = 'expo-device';

const isBrowser = (): boolean => typeof window !== 'undefined';

export const getStoredToken = (): string | null => {
  if (!isBrowser()) {
    return null;
  }

  return window.localStorage.getItem(AUTH_TOKEN_KEY);
};

export const getStoredUser = (): AuthUser | null => {
  if (!isBrowser()) {
    return null;
  }

  const rawUser = window.localStorage.getItem(AUTH_USER_KEY);

  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser) as AuthUser;
  } catch {
    clearStoredAuth();
    return null;
  }
};

export const setStoredAuth = (token: string, user: AuthUser): void => {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
};

export const clearStoredAuth = (): void => {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_USER_KEY);
};

export const isAuthenticated = (): boolean => getStoredToken() !== null;
