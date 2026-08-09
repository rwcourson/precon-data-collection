import "server-only";
import { cookies } from "next/headers";
import { getCurrentUser } from "./current-user";
import { getMobileContext } from "./mobile-context";
import { resolveWorkspace, WORKSPACE_COOKIE, type Workspace } from "./workspace";

/** Resolves the active Region workspace from the persona + workspace cookie. */
export async function getWorkspace(): Promise<Workspace> {
  const user = await getCurrentUser();
  const mobile = getMobileContext();
  if (mobile) {
    return resolveWorkspace(user, mobile.workspaceCookie);
  }
  const store = await cookies();
  return resolveWorkspace(user, store.get(WORKSPACE_COOKIE)?.value);
}
