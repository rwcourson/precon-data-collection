import { cn } from "@/lib/utils";

export type CopilotBlock =
  | { type: "p"; text: string }
  | { type: "h"; level: 1 | 2 | 3; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] };

const NEXT_BLOCK = /^(#{1,3}\s+|[-*]\s+|\d+\.\s+)/;

export function parseCopilotMarkdown(source: string): CopilotBlock[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
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
      blocks.push({ type: "h", level: heading[1].length as 1 | 2 | 3, text: heading[2] });
      i += 1;
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
    while (i < lines.length && lines[i].trim() && !NEXT_BLOCK.test(lines[i])) {
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
        <code key={index} className="rounded-sm bg-muted px-1 py-0.5 font-mono text-sm">
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
    <div className={cn("space-y-3 text-sm leading-6 break-words text-pretty", className)}>
      {blocks.map((block, index) => {
        if (block.type === "h") {
          const Tag = (`h${block.level}` as "h1" | "h2" | "h3");
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
