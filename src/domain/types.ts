import type { Role } from "@/db/schema";

/**
 * Branded session user id — services accept this instead of trusting
 * client-supplied user identifiers for authorization.
 */
export type AuthenticatedUserId = number & { readonly __brand: "AuthenticatedUserId" };

export function asAuthenticatedUserId(id: number): AuthenticatedUserId {
  return id as AuthenticatedUserId;
}

/** Minimal actor identity passed into domain services. */
export type DomainActor = {
  id: AuthenticatedUserId;
  role: Role;
  region: string | null;
  name: string;
  title: string;
  email: string;
};

/** Repository / provider ports are injected; services never import React or UI. */
export type PortDeps<T extends object> = Partial<T>;
