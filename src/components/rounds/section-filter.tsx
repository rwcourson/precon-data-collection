import { ToolbarField } from "@/components/ui/toolbar-controls";
import { UrlSelect } from "@/components/url-select";
import type { UrlSelectOption } from "@/lib/select-options";

/**
 * Top-of-page dropdown to jump/filter a long form or sheet to one field group.
 * `section` stays in the query string so Form/Sheet and tab switches keep it.
 */
export function SectionFilter({
  pathname,
  value,
  options,
  currentParams,
}: {
  pathname: string;
  value: string;
  options: UrlSelectOption[];
  currentParams?: Record<string, string | undefined>;
}) {
  if (options.length <= 1) return null;
  return (
    <ToolbarField label="Section">
      <UrlSelect
        pathname={pathname}
        param="section"
        value={value}
        options={options}
        currentParams={currentParams}
        omitValues={["all"]}
        className="min-w-[14rem] max-w-[min(24rem,100%)]"
      />
    </ToolbarField>
  );
}
