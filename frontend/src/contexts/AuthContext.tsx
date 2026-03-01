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

// Decode JWT payload without an external library
function parseJwtPayload(token: string): Record<string, unknown> {
  const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(atob(base64));
}

// Build a minimal User from JWT payload — enough for auth checks and UI.
// Full profile (email, phone, etc.) is fetched in background after mount.
function userFromToken(token: string): User {
  const p = parseJwtPayload(token);
  return {
    id: p.sub as string,
    username: p.username as string,
    full_name: p.full_name as string,
    email: null,
    phone: null,
    telegram_id: null,
    is_active: true,
    is_verified: true,
    last_login_at: null,
    created_at: "",
    roles: (p.roles as string[]).map((name) => ({
      id: "",
      name,
      display_name: name,
      description: null,
      is_system: true,
    })),
    permissions: p.permissions as string[],
  };
}

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

  // Silent refresh on mount — restore session from HttpOnly cookie.
  // Optimized: decode JWT locally (1 API call) instead of calling /auth/me (2 calls).
  // Full profile is fetched in background so it doesn't block the spinner.
  useEffect(() => {
    const tryRestore = async () => {
      try {
        const { data } = await api.post<{ access_token: string }>("/auth/refresh");
        setAccessToken(data.access_token);
        // Set user immediately from JWT — hides spinner after just 1 network round-trip
        setUser(userFromToken(data.access_token));
        startRefreshTimer();
        // Fetch full profile (email, phone, roles with display names) in background
        fetchMe(data.access_token).then((me) => {
          if (me) setUser(me);
        });
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
