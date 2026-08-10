import {
  inspectRuntimeConfig,
  runtimeDiagnostics,
  type RuntimeConfigStatus,
} from "@/lib/runtime-config";

export type ReadinessResult = {
  status: 200 | 503;
  body: {
    ready: boolean;
    diagnostics: ReturnType<typeof runtimeDiagnostics>;
    dependencies: { database: "ready" | "unavailable" | "not-checked" };
  };
};

/** Builds a sanitized readiness result; dependency errors never cross the boundary. */
export async function checkReadiness(
  probeDatabase: () => Promise<void>,
  status: RuntimeConfigStatus = inspectRuntimeConfig(),
): Promise<ReadinessResult> {
  if (!status.ok) {
    return {
      status: 503,
      body: {
        ready: false,
        diagnostics: runtimeDiagnostics(status),
        dependencies: { database: "not-checked" },
      },
    };
  }

  try {
    await probeDatabase();
    return {
      status: 200,
      body: {
        ready: true,
        diagnostics: runtimeDiagnostics(status),
        dependencies: { database: "ready" },
      },
    };
  } catch {
    return {
      status: 503,
      body: {
        ready: false,
        diagnostics: runtimeDiagnostics(status),
        dependencies: { database: "unavailable" },
      },
    };
  }
}
