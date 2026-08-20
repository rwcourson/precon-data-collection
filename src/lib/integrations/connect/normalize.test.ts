import { describe, expect, it } from "vitest";
import { normaliseConnectJob, normaliseConnectJobs } from "./normalize";

describe("Connect REST normalisation", () => {
  it("accepts Salesforce and Connect field names", () => {
    expect(
      normaliseConnectJob({
        Id: "sf-1",
        JobNumber: "24150",
        Name: "Midtown",
        Region: "Central",
      })
    ).toMatchObject({
      sfId: "sf-1",
      jobNumber: "24150",
      jobName: "Midtown",
      region: "Central",
    });
  });

  it("returns null for incomplete records and 404-style empty payloads", () => {
    expect(normaliseConnectJob({ id: "x" })).toBeNull();
    expect(normaliseConnectJob(null)).toBeNull();
    expect(normaliseConnectJobs({ records: [{ Id: "a" }] })).toEqual([]);
  });

  it("reads wrapped record lists", () => {
    expect(
      normaliseConnectJobs({
        records: [{ sfId: "1", jobNumber: "1", jobName: "One" }],
      })
    ).toHaveLength(1);
  });
});
