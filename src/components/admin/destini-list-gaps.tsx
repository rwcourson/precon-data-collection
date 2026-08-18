import { Badge } from "@/components/ui/badge";
import { compareDestiniLists } from "@/lib/destini-validation-lists";
import { REFERENCE_LISTS } from "@/lib/reference-data";

/** Server-rendered Destini Data Validation vs seeded reference list gaps. */
export function DestiniListGaps() {
  const gaps = compareDestiniLists(REFERENCE_LISTS);

  if (gaps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Seeded reference lists match the Destini Data Validation sheet
        (dash-insensitive).
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {gaps.length} list{gaps.length === 1 ? "" : "s"} differ from Destini
        markup. Import still works — these affect dropdown entry, not Destini
        dollar fields.
      </p>
      {gaps.map((g) => (
        <div key={g.listKey} className="rounded-md border p-3">
          <div className="mb-2 flex items-center gap-2">
            <p className="text-sm font-medium">{g.label}</p>
            <Badge variant="outline" size="sm">
              {g.listKey}
            </Badge>
          </div>
          {g.missingInApp.length > 0 && (
            <div className="mb-2">
              <p className="text-2xs font-medium text-warning-foreground">
                In Destini, missing from app ({g.missingInApp.length})
              </p>
              <p className="mt-1 text-2xs text-muted-foreground">
                {g.missingInApp.slice(0, 12).join(" · ")}
                {g.missingInApp.length > 12 ? "…" : ""}
              </p>
            </div>
          )}
          {g.extraInApp.length > 0 && (
            <div>
              <p className="text-2xs font-medium text-muted-foreground">
                In app, not in Destini ({g.extraInApp.length})
              </p>
              <p className="mt-1 text-2xs text-muted-foreground">
                {g.extraInApp.slice(0, 12).join(" · ")}
                {g.extraInApp.length > 12 ? "…" : ""}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
