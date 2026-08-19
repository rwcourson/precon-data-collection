import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";
import { auth } from "@/lib/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = oauthProviderAuthServerMetadata(auth);

export const GET = handler;
export const HEAD = handler;
