"use client";

import { useEffect, useRef } from "react";
import { saveBidScheduleTablePrefs } from "@/actions/table-prefs";

/** Persist density from the URL control without remounting with the sheet. */
export function TablePrefsDensitySync({
  density,
  enabled,
}: {
  density: "summary" | "detail";
  enabled: boolean;
}) {
  const prev = useRef(density);
  useEffect(() => {
    if (!enabled) return;
    if (prev.current === density) return;
    prev.current = density;
    void saveBidScheduleTablePrefs({ density });
  }, [density, enabled]);
  return null;
}
