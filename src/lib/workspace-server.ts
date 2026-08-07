import "server-only";
import { cookies } from "next/headers";
import { getCurrentUser } from "./current-user";
import { resolveWorkspace, WORKSPACE_COOKIE, type Workspace } from "./workspace";

/** Resolves the active Region workspace from the persona + workspace cookie. */
export async function getWorkspace(): Promise<Workspace> {
  const [user, store] = await Promise.all([getCurrentUser(), cookies()]);
  return resolveWorkspace(user, store.get(WORKSPACE_COOKIE)?.value);
}
