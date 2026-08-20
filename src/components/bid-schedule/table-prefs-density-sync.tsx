"use client";

import { useEffect, useRef } from "react";
import { saveBidScheduleTablePrefs } from "@/actions/table-prefs";

/** Persist density from the URL control without remounting with the sheet. */
export function TablePrefsDensitySync({
  density,
  viewMode,
  enabled,
}: {
  density: "summary" | "detail";
  viewMode: "table" | "cards" | "gantt";
  enabled: boolean;
}) {
  const prev = useRef({ density, viewMode });
  useEffect(() => {
    if (!enabled) return;
    if (prev.current.density === density && prev.current.viewMode === viewMode)
      return;
    prev.current = { density, viewMode };
    void saveBidScheduleTablePrefs({ density, viewMode });
  }, [density, enabled, viewMode]);
  return null;
}
