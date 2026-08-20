import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DeviceAuthorizationClient } from "@/components/auth/device-authorization-client";
import { authMode } from "@/lib/auth";
import { auth } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function DeviceAuthorizationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const userCode =
    typeof params.user_code === "string" ? params.user_code : undefined;

  if (authMode() === "sso") {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      const next = userCode
        ? `/device?user_code=${encodeURIComponent(userCode)}`
        : "/device";
      redirect(`/sign-in?next=${encodeURIComponent(next)}`);
    }
  }

  return <DeviceAuthorizationClient initialCode={userCode} />;
}
