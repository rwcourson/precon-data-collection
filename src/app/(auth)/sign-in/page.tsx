import { SignInClient } from "@/components/auth/sign-in-client";
import { getRuntimeConfig } from "@/lib/runtime-config";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;

  // Never bounce to `/` just because a session_token cookie exists. A stale
  // Better Auth cookie plus `(app)/layout`'s getSession check 307-loops
  // `/` ↔ `/sign-in`. The client confirms a live session before navigating.
  return (
    <SignInClient
      sso={getRuntimeConfig().authMode === "sso"}
      initialNext={params.next}
      initialError={params.error}
    />
  );
}
