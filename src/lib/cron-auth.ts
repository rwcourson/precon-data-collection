import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { inspectRuntimeConfig, runtimeDiagnostics } from "@/lib/runtime-config";

function equalSecret(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return (
    actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
  );
}

/** Fail-closed scheduler authentication shared by every cron entry point. */
export function authorizeCron(req: Request): NextResponse | null {
  const status = inspectRuntimeConfig();
  if (!status.ok) {
    return NextResponse.json(
      {
        error: "Service configuration is unavailable.",
        diagnostics: runtimeDiagnostics(status),
      },
      { status: 503 }
    );
  }
  if (!status.config.cronSecret) {
    return NextResponse.json(
      { error: "Scheduler authentication is unavailable." },
      { status: 503 }
    );
  }
  const authorization = req.headers.get("authorization") ?? "";
  if (!equalSecret(authorization, `Bearer ${status.config.cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
