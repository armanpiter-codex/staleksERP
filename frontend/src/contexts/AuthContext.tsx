"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import api, { getAccessToken, setAccessToken } from "@/lib/api";
import type { AuthContextValue, User } from "@/types/auth";

const AuthContext = createContext<AuthContextValue | null>(null);

const REFRESH_INTERVAL_MS = 13 * 60 * 1000; // 13 minutes (before 15-min expiry)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearRefreshTimer = () => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  };

  const startRefreshTimer = useCallback(() => {
    clearRefreshTimer();
    refreshTimerRef.current = setInterval(async () => {
      try {
        const { data } = await api.post<{ access_token: string }>("/auth/refresh");
        setAccessToken(data.access_token);
      } catch {
        // Refresh failed — token expired, redirect to login
        setUser(null);
        setAccessToken(null);
        clearRefreshTimer();
      }
    }, REFRESH_INTERVAL_MS);
  }, []);

  const fetchMe = useCallback(async (token: string): Promise<User | null> => {
    try {
      setAccessToken(token);
      const { data } = await api.get<User>("/auth/me");
      return data;
    } catch {
      setAccessToken(null);
      return null;
    }
  }, []);

  // Silent refresh on mount — restore session from HttpOnly cookie
  useEffect(() => {
    const tryRestore = async () => {
      try {
        const { data } = await api.post<{ access_token: string }>("/auth/refresh");
        const me = await fetchMe(data.access_token);
        if (me) {
          setUser(me);
          startRefreshTimer();
        }
      } catch {
        // No valid session — user needs to log in
      } finally {
        setIsLoading(false);
      }
    };

    tryRestore();

    return () => clearRefreshTimer();
  }, [fetchMe, startRefreshTimer]);

  const login = useCallback(
    async (username: string, password: string): Promise<void> => {
      const { data } = await api.post<{ access_token: string }>("/auth/login", {
        username,
        password,
      });

      const me = await fetchMe(data.access_token);
      if (!me) {
        throw new Error("Failed to load user profile after login");
      }

      setUser(me);
      startRefreshTimer();
    },
    [fetchMe, startRefreshTimer]
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Ignore logout errors
    } finally {
      setUser(null);
      setAccessToken(null);
      clearRefreshTimer();
    }
  }, []);

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!user) return false;
      return user.permissions.includes(permission);
    },
    [user]
  );

  const hasRole = useCallback(
    (role: string): boolean => {
      if (!user) return false;
      return user.roles.some((r) => r.name === role);
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken: getAccessToken(),
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        hasPermission,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
