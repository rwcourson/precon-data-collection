/**
 * Strip common Markdown so chat stays plain prose (no bold/lists/headings).
 * Applied after model output as a safety net; prompts also forbid Markdown.
 */
export function toPlainText(input: string): string {
  let text = input.replace(/\r\n/g, "\n").trim();
  if (!text) return "";

  // Fenced code blocks → inner text
  text = text.replace(/```[\w-]*\n?([\s\S]*?)```/g, (_, body: string) =>
    body.trim()
  );
  // Inline code
  text = text.replace(/`([^`]+)`/g, "$1");
  // Images / links → label
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // Headings
  text = text.replace(/^#{1,6}\s+/gm, "");
  // Bold / italic (order matters: *** before **, * last)
  text = text.replace(/\*\*\*([^*\n]+)\*\*\*/g, "$1");
  text = text.replace(/___([^_\n]+)___/g, "$1");
  text = text.replace(/\*\*([^*\n]+)\*\*/g, "$1");
  text = text.replace(/__([^_\n]+)__/g, "$1");
  text = text.replace(/\*([^*\n]+)\*/g, "$1");
  text = text.replace(/_([^_\n]+)_/g, "$1");
  text = text.replace(/~~([^~\n]+)~~/g, "$1");
  // Blockquotes
  text = text.replace(/^>\s?/gm, "");
  // Horizontal rules
  text = text.replace(/^\s*([-*_]){3,}\s*$/gm, "");
  // Unordered list markers
  text = text.replace(/^\s*[-*+]\s+/gm, "");
  // Ordered list markers
  text = text.replace(/^\s*\d+\.\s+/gm, "");
  // Collapse excess blank lines
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}
