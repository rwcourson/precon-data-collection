import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSheetGridMatrix,
  dueDateBand,
  sheetDisplayName,
} from "../src/lib/mobile-data-display.ts";

test("the shipped Expo formatter produces human sheet names", () => {
  assert.equal(sheetDisplayName("pcn_bid_schedule"), "Bid Schedule");
});

test("the shipped Expo date bucketing is deterministic", () => {
  assert.equal(dueDateBand("2026-08-08", new Date(2026, 7, 9)), "overdue");
  assert.equal(dueDateBand("2026-08-12", new Date(2026, 7, 9)), "this_week");
});

test("the shipped Expo sheet matrix keeps columns aligned", () => {
  const matrix = buildSheetGridMatrix(
    [
      { key: "project", label: "Project" },
      { key: "region", label: "Region" },
    ],
    [{ id: 7, values: { project: "Library", region: "Central" } }],
  );

  assert.deepEqual(matrix.headers, ["Project", "Region"]);
  assert.deepEqual(matrix.body[0]?.cells, ["Library", "Central"]);
});
