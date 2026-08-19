import { auth } from "@/lib/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request): Promise<Response> {
  return auth.handler(request);
}

export const GET = handle;
export const HEAD = handle;
