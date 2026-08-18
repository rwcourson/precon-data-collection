import { cn } from "@/lib/utils";

export type CopilotBlock =
  | { type: "p"; text: string }
  | { type: "h"; level: 1 | 2 | 3; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] };

const NEXT_BLOCK = /^(#{1,3}\s+|[-*]\s+|\d+\.\s+)/;

function isTableRow(line: string) {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.includes("|", 1);
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim();
  const inner = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
  const withoutEnd = inner.endsWith("|") ? inner.slice(0, -1) : inner;
  return withoutEnd.split("|").map((cell) => cell.trim());
}

function isTableSeparator(line: string) {
  if (!isTableRow(line)) return false;
  const cells = splitTableRow(line);
  return (
    cells.length > 0 &&
    cells.every((cell) => /^:?-{2,}:?$/.test(cell.replace(/\s+/g, "")))
  );
}

function isSeparatorCell(cell: string) {
  return /^:?-{2,}:?$/.test(cell.replace(/\s+/g, ""));
}

/** Streaming often joins table rows onto one line; put each `| ... |` back on its own. */
export function restoreCollapsedTables(source: string): string {
  if (!source.includes("|")) return source;
  const tableLines = source
    .split("\n")
    .filter((line) => line.trim().startsWith("|"));
  if (tableLines.length >= 2) return source;
  const start = source.indexOf("|");
  if (start < 0) return source;
  const cells = splitTableRow(source.slice(start));
  const sepStart = cells.findIndex(isSeparatorCell);
  if (sepStart < 1) return source;
  const headers = cells.slice(0, sepStart).filter((cell) => cell !== "");
  if (headers.length < 2) return source;
  let index = sepStart;
  while (
    index < cells.length &&
    (isSeparatorCell(cells[index]) || cells[index] === "")
  ) {
    index += 1;
  }
  const rows: string[][] = [];
  while (index < cells.length) {
    if (cells[index] === "") {
      index += 1;
      continue;
    }
    rows.push(cells.slice(index, index + headers.length));
    index += headers.length;
  }
  const table = [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "--").join(" | ")} |`,
    ...rows.map(
      (row) =>
        `| ${headers.map((_, cellIndex) => row[cellIndex] ?? "").join(" | ")} |`
    ),
  ].join("\n");
  const prefix = source.slice(0, start).trimEnd();
  return prefix ? `${prefix}\n${table}` : table;
}

export function parseCopilotMarkdown(source: string): CopilotBlock[] {
  const lines = restoreCollapsedTables(source)
    .replace(/\r\n/g, "\n")
    .split("\n");
  const blocks: CopilotBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({
        type: "h",
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2],
      });
      i += 1;
      continue;
    }
    if (
      isTableRow(line) &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1])
    ) {
      const headers = splitTableRow(line);
      i += 2;
      const rows: string[][] = [];
      while (
        i < lines.length &&
        isTableRow(lines[i]) &&
        !isTableSeparator(lines[i])
      ) {
        const cells = splitTableRow(lines[i]);
        rows.push(headers.map((_, index) => cells[index] ?? ""));
        i += 1;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    }
    const parts = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !NEXT_BLOCK.test(lines[i]) &&
      !isTableRow(lines[i])
    ) {
      parts.push(lines[i]);
      i += 1;
    }
    blocks.push({ type: "p", text: parts.join(" ") });
  }
  return blocks;
}

function CopilotInline({ text }: { text: string }) {
  const chunks = text.split(/(\*\*[^*]+?\*\*|\*\*[^*]*$|\*[^*]+?\*|`[^`]+?`)/g);
  return chunks.map((chunk, index) => {
    if (!chunk) return null;
    if (chunk.startsWith("**")) {
      const closed = chunk.endsWith("**") && chunk.length > 2;
      const value = closed ? chunk.slice(2, -2) : chunk.slice(2);
      return (
        <strong key={index} className="font-semibold text-foreground">
          {value}
        </strong>
      );
    }
    if (chunk.startsWith("*") && chunk.endsWith("*") && chunk.length > 2) {
      return (
        <em key={index} className="italic">
          {chunk.slice(1, -1)}
        </em>
      );
    }
    if (chunk.startsWith("`") && chunk.endsWith("`") && chunk.length > 2) {
      return (
        <code
          key={index}
          className="rounded-sm bg-muted px-1 py-0.5 font-mono text-sm"
        >
          {chunk.slice(1, -1)}
        </code>
      );
    }
    return <span key={index}>{chunk}</span>;
  });
}

function headingClass(level: 1 | 2 | 3) {
  if (level === 1) return "font-heading text-base font-semibold tracking-tight";
  if (level === 2) return "font-heading text-sm font-semibold tracking-tight";
  return "font-heading text-sm font-semibold tracking-tight";
}

function isStandaloneTitle(text: string) {
  return /^\*\*[^*]+\*\*$/.test(text.trim());
}

export function CopilotMarkdown({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const blocks = parseCopilotMarkdown(text);
  return (
    <div
      className={cn(
        "space-y-3 text-sm leading-6 break-words text-pretty",
        className
      )}
    >
      {blocks.map((block, index) => {
        if (block.type === "h") {
          const Tag = `h${block.level}` as "h1" | "h2" | "h3";
          return (
            <Tag key={index} className={headingClass(block.level)}>
              <CopilotInline text={block.text} />
            </Tag>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={index} className="list-disc space-y-2 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <CopilotInline text={item} />
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === "ol") {
          return (
            <ol key={index} className="list-decimal space-y-2 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <CopilotInline text={item} />
                </li>
              ))}
            </ol>
          );
        }
        if (block.type === "table") {
          return (
            <div
              key={index}
              className="overflow-x-auto rounded-lg border bg-card"
            >
              <table className="w-full min-w-[20rem] text-left text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    {block.headers.map((header, headerIndex) => (
                      <th
                        key={headerIndex}
                        className="px-3 py-2 font-medium whitespace-nowrap"
                      >
                        <CopilotInline text={header} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-t">
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className="px-3 py-2 align-top leading-snug"
                        >
                          <CopilotInline text={cell} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (isStandaloneTitle(block.text)) {
          return (
            <p key={index} className={headingClass(2)}>
              <CopilotInline text={block.text} />
            </p>
          );
        }
        return (
          <p key={index}>
            <CopilotInline text={block.text} />
          </p>
        );
      })}
    </div>
  );
}
