import { describe, expect, it } from "vitest";
import { bidScheduleGroupBySchema, createApiTokenSchema } from "./contracts";
import {
  DomainError,
  findDomainError,
  getDomainErrorHttpStatus,
} from "./errors";

describe("DomainError", () => {
  it("serializes safe fields without a stack", () => {
    const err = DomainError.forbidden("Cannot lock round", "Wrong region");
    const json = err.toJSON();
    expect(json).toEqual({
      code: "FORBIDDEN",
      what: "Cannot lock round",
      why: "Wrong region",
      solution: "Ask an RPD/SPD or Corporate Admin for access.",
    });
    expect(JSON.stringify(json)).not.toMatch(/stack/i);
  });

  it("maps codes to HTTP statuses", () => {
    expect(getDomainErrorHttpStatus(DomainError.notFound("Round"))).toBe(404);
    expect(getDomainErrorHttpStatus(DomainError.unauthorized())).toBe(401);
    expect(getDomainErrorHttpStatus(DomainError.unavailable("Email"))).toBe(
      503
    );
  });

  it("finds nested domain errors", () => {
    const inner = DomainError.badRequest("Bad email");
    const outer = new Error("wrap", { cause: inner });
    expect(findDomainError(outer)?.what).toBe("Bad email");
    expect(findDomainError(new Error("plain"))).toBeNull();
  });
});

describe("Zod contracts", () => {
  it("accepts bid-schedule group-by values", () => {
    expect(bidScheduleGroupBySchema.parse("marketSector")).toBe("marketSector");
    expect(() => bidScheduleGroupBySchema.parse("owner")).toThrow();
  });

  it("requires at least one API token scope", () => {
    expect(() =>
      createApiTokenSchema.parse({ name: "Magnus", scopes: [] })
    ).toThrow();
    expect(
      createApiTokenSchema.parse({
        name: "Magnus read",
        scopes: ["read:pursuits"],
        expiresAt: "2026-09-01T00:00:00.000Z",
      }).scopes
    ).toEqual(["read:pursuits"]);
  });
});
