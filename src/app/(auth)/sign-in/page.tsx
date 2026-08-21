import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignInClient } from "@/components/auth/sign-in-client";
import { cookiesLookLikeBetterAuthSession } from "@/lib/auth-constants";
import { getRuntimeConfig } from "@/lib/runtime-config";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;

  // Cookie presence only — keep Better Auth / Drizzle off this first compile.
  // `(app)/layout` still validates the session before rendering chrome.
  if (getRuntimeConfig().authMode === "sso") {
    if (cookiesLookLikeBetterAuthSession((await cookies()).getAll())) {
      const next = params.next?.startsWith("/") ? params.next : "/";
      redirect(next);
    }
  }

  return <SignInClient initialNext={params.next} initialError={params.error} />;
}
