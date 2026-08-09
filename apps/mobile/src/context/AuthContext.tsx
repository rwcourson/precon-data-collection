import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  fetchMe,
  listDemoUsers,
  loginDemo,
  loginWithToken,
  logout as apiLogout,
  type PublicUser,
} from "@/src/api/auth";
import { getStoredToken, setWorkspaceHeader } from "@/src/api/client";

type AuthState = {
  user: PublicUser | null;
  workspaceLabel: string;
  workspaceRegion: string | null;
  availableRegions: string[];
  loading: boolean;
  error: string | null;
  personas: PublicUser[];
  signInDemo: (userId: number) => Promise<void>;
  signInToken: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  setWorkspace: (region: string) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [workspaceLabel, setWorkspaceLabel] = useState("Corporate");
  const [workspaceRegion, setWorkspaceRegion] = useState<string | null>(null);
  const [availableRegions, setAvailable] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [personas, setPersonas] = useState<PublicUser[]>([]);

  const refresh = useCallback(async () => {
    setError(null);
    const token = await getStoredToken();
    // Cold start without a session is normal — do not surface as an error on sign-in.
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const me = await fetchMe();
      setUser(me.user);
      setWorkspaceLabel(me.workspace.label);
      setWorkspaceRegion(me.workspace.region);
      setAvailable(me.workspace.available);
    } catch (e) {
      setUser(null);
      setError(e instanceof Error ? e.message : "Not signed in");
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const users = await listDemoUsers().catch(() => []);
        setPersonas(users);
        await refresh();
        // Optional smoke auto-login for Simulator verification only
        if (
          process.env.EXPO_PUBLIC_SMOKE_LOGIN === "1" &&
          users.length > 0 &&
          !(await getStoredToken())
        ) {
          await loginDemo(users[0].id);
          const me = await fetchMe();
          setUser(me.user);
          setWorkspaceLabel(me.workspace.label);
          setWorkspaceRegion(me.workspace.region);
          setAvailable(me.workspace.available);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  const signInDemo = useCallback(async (userId: number) => {
    setLoading(true);
    setError(null);
    try {
      await loginDemo(userId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
      throw e;
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const signInToken = useCallback(async (token: string) => {
    setLoading(true);
    try {
      await loginWithToken(token);
      await refresh();
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const signOut = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  const setWorkspace = useCallback(async (region: string) => {
    await setWorkspaceHeader(region);
    const { apiFetch } = await import("@/src/api/client");
    await apiFetch("/api/v1/mobile/workspace", {
      method: "POST",
      body: JSON.stringify({ region }),
    });
    await refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      user,
      workspaceLabel,
      workspaceRegion,
      availableRegions,
      loading,
      error,
      personas,
      signInDemo,
      signInToken,
      signOut,
      refresh,
      setWorkspace,
    }),
    [
      user,
      workspaceLabel,
      workspaceRegion,
      availableRegions,
      loading,
      error,
      personas,
      signInDemo,
      signInToken,
      signOut,
      refresh,
      setWorkspace,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth requires AuthProvider");
  return ctx;
}
