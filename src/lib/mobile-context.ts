import { AsyncLocalStorage } from "node:async_hooks";
import type { User } from "@/db/schema";
import type { Principal } from "@/lib/authorization/types";

/**
 * Request-scoped identity for mobile REST handlers. Lets existing server
 * actions that call getCurrentUser() / getWorkspace() work without cookies
 * when invoked from /api/v1/mobile/*.
 */
export type MobileRequestContext = {
  user: User;
  /** Cookie-equivalent workspace region; "corporate" or a region name. */
  workspaceCookie?: string;
  authorization?: Principal;
};

export const mobileContext = new AsyncLocalStorage<MobileRequestContext>();

export function getMobileContext(): MobileRequestContext | undefined {
  return mobileContext.getStore();
}

export function runWithMobileContext<T>(
  ctx: MobileRequestContext,
  fn: () => T | Promise<T>
): T | Promise<T> {
  return mobileContext.run(ctx, fn);
}
