import { apiFetch, setStoredToken, getStoredToken } from "./client";

export type PublicUser = {
  id: number;
  name: string;
  title: string;
  role: string;
  region: string | null;
  preconDepartment: string | null;
  email: string;
};

export async function listDemoUsers(): Promise<PublicUser[]> {
  const res = await apiFetch<{ data: PublicUser[] }>("/api/v1/mobile/users");
  return res.data;
}

export async function loginDemo(userId: number): Promise<{ token: string; user: PublicUser }> {
  const res = await apiFetch<{ token: string; user: PublicUser }>(
    "/api/v1/mobile/auth/demo",
    { method: "POST", body: JSON.stringify({ userId }) },
  );
  await setStoredToken(res.token);
  return res;
}

export async function loginWithToken(token: string): Promise<void> {
  await setStoredToken(token);
}

export async function logout(): Promise<void> {
  await setStoredToken(null);
}

export async function fetchMe() {
  return apiFetch<{
    user: PublicUser;
    workspace: {
      region: string | null;
      label: string;
      available: string[];
      canViewCorporate: boolean;
    };
    source: string;
  }>("/api/v1/mobile/me");
}

export async function hasSession(): Promise<boolean> {
  return Boolean(await getStoredToken());
}
