import { FileSpreadsheet, LayoutList } from "lucide-react";
import {
  ToolbarField,
  ToolbarSegment,
  ToolbarSegmented,
} from "@/components/ui/toolbar-controls";
import type { EntryViewMode } from "@/lib/entry-view";

/**
 * Same View control as Bid Schedule — Form is the grouped cards, Sheet is the
 * live grid of those same fields. URL `?viewMode=sheet` selects the grid.
 */
export function FormSheetToggle({
  formHref,
  sheetHref,
  value,
  sheetLabel = "Sheet",
  formLabel = "Form",
}: {
  formHref: string;
  sheetHref: string;
  value: EntryViewMode;
  sheetLabel?: string;
  formLabel?: string;
}) {
  return (
    <ToolbarField label="View">
      <ToolbarSegmented>
        {(
          [
            {
              key: "form" as const,
              label: formLabel,
              href: formHref,
              icon: LayoutList,
            },
            {
              key: "sheet" as const,
              label: sheetLabel,
              href: sheetHref,
              icon: FileSpreadsheet,
            },
          ] as const
        ).map(({ key, label, href, icon: Icon }) => (
          <ToolbarSegment key={key} href={href} active={value === key}>
            <Icon className="size-3.5" />
            {label}
          </ToolbarSegment>
        ))}
      </ToolbarSegmented>
    </ToolbarField>
  );
}
