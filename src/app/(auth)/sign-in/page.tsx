import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignInClient } from "@/components/auth/sign-in-client";
import { authMode } from "@/lib/auth";
import { auth } from "@/lib/auth-server";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;

  // Already signed in → home (or requested next path).
  if (authMode() === "sso") {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user) {
      const next = params.next && params.next.startsWith("/") ? params.next : "/";
      redirect(next);
    }
  }

  return <SignInClient initialNext={params.next} initialError={params.error} />;
}
