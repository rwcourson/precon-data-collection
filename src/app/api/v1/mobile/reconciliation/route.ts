import { getDmrReconciliation, importDmrUpload } from "@/actions/dmr";
import { jsonError, jsonOk, mapError, withMobileAuth } from "@/lib/mobile-http";

export async function GET(req: Request) {
  return withMobileAuth(req, async () => {
    const id = Number(new URL(req.url).searchParams.get("importId") ?? 0);
    if (!id) {
      return jsonOk({
        data: null,
        status: "idle",
        message: "Upload DMR lines or pass importId",
      });
    }
    try {
      const data = await getDmrReconciliation(id);
      return jsonOk({ data, status: "ok" });
    } catch (err) {
      return mapError(err);
    }
  });
}

export async function POST(req: Request) {
  return withMobileAuth(req, async () => {
    let body: {
      name?: string;
      periodKey?: string;
      lines?: { jobNumber: string; jobName?: string; region?: string; dmrValue: number }[];
      text?: string;
      filename?: string;
    };
    try {
      body = await req.json();
    } catch {
      return jsonError("Invalid JSON", 400);
    }
    try {
      let lines = body.lines ?? [];
      if (!lines.length && body.text) {
        // Parse simple CSV: jobNumber,dmrValue
        lines = body.text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean)
          .filter((l) => !/^job/i.test(l))
          .map((line) => {
            const [jobNumber, dmrValue, jobName, region] = line.split(",").map((s) => s.trim());
            return {
              jobNumber: jobNumber ?? "",
              dmrValue: Number(dmrValue) || 0,
              jobName,
              region,
            };
          })
          .filter((l) => l.jobNumber);
      }
      const importId = await importDmrUpload({
        name: body.name ?? body.filename ?? "DMR upload",
        periodKey: body.periodKey,
        lines,
      });
      return jsonOk({ status: "success", importId });
    } catch (err) {
      return mapError(err);
    }
  });
}
