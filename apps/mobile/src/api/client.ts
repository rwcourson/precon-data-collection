import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "precon_mobile_token";
const WORKSPACE_KEY = "precon_workspace_region";

export function getApiBaseUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:3000";
}

export async function getStoredToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setStoredToken(token: string | null): Promise<void> {
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function getWorkspaceHeader(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(WORKSPACE_KEY);
  } catch {
    return null;
  }
}

export async function setWorkspaceHeader(region: string | null): Promise<void> {
  if (region) await SecureStore.setItemAsync(WORKSPACE_KEY, region);
  else await SecureStore.deleteItemAsync(WORKSPACE_KEY);
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getStoredToken();
  const workspace = await getWorkspaceHeader();
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (init.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers.Authorization = `Bearer ${token}`;
  if (workspace) headers["X-Workspace-Region"] = workspace;

  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }

  if (!res.ok) {
    const msg =
      data && typeof data === "object" && data !== null && "error" in data
        ? String((data as { error: string }).error)
        : `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, data);
  }
  return data as T;
}
