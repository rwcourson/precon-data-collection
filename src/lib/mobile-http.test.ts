import { describe, expect, it } from "vitest";
import { DomainError } from "@/domain/errors";
import { mapError } from "@/lib/mobile-http";

async function bodyOf(res: Response) {
  return (await res.json()) as { error: string; code?: string };
}

describe("mapError (shipped)", () => {
  it("maps DomainError.forbidden to 403 with code", async () => {
    const res = mapError(DomainError.forbidden("Nope", "role check"));
    expect(res.status).toBe(403);
    const body = await bodyOf(res);
    expect(body.error).toBe("Nope");
    expect(body.code).toBe("FORBIDDEN");
  });

  it("maps DomainError.unauthorized to 401", async () => {
    const res = mapError(DomainError.unauthorized("Sign in"));
    expect(res.status).toBe(401);
    const body = await bodyOf(res);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("maps plain permission errors to 403", async () => {
    const res = mapError(new Error("Permission denied: cannot write"));
    expect(res.status).toBe(403);
    const body = await bodyOf(res);
    expect(body.code).toBe("FORBIDDEN");
  });

  it("maps not-found phrasing to 404", async () => {
    const res = mapError(new Error("Round not found"));
    expect(res.status).toBe(404);
    const body = await bodyOf(res);
    expect(body.code).toBe("NOT_FOUND");
  });

  it("maps other Errors to 400", async () => {
    const res = mapError(new Error("bad input"));
    expect(res.status).toBe(400);
    const body = await bodyOf(res);
    expect(body.error).toBe("bad input");
  });
});
