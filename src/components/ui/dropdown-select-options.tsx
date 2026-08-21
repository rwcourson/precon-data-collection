import { SelectItem, SelectSeparator } from "@/components/ui/select";
import { DROPDOWN_NONE_VALUE, listHasNone } from "@/lib/dropdown-none";

/** Standard list plus a clear option, unless the managed list already has None. */
export function DropdownSelectOptions({
  options,
}: {
  options: readonly string[];
}) {
  const includeNone = !listHasNone(options);
  return (
    <>
      {includeNone ? (
        <>
          <SelectItem
            value={DROPDOWN_NONE_VALUE}
            className="text-muted-foreground"
          >
            None
          </SelectItem>
          <SelectSeparator />
        </>
      ) : null}
      {options.map((option) => (
        <SelectItem key={option} value={option}>
          {option}
        </SelectItem>
      ))}
    </>
  );
}
