import { SignInClient } from "@/components/auth/sign-in-client";

export default function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  return <SignInClient searchParams={searchParams} />;
}
