"use client";

import {
  type KeyboardEvent,
  type RefObject,
  useLayoutEffect,
  useRef,
} from "react";
import {
  formatMentionToken,
  mentionChipClassName,
  mentionLabel,
  splitNoteBodyTokens,
} from "@/lib/note-body";
import { cn } from "@/lib/utils";

function serializeComposer(
  root: HTMLElement,
  caretNode: Node | null,
  caretOffset: number
): { body: string; caret: number } {
  const onlyBreak =
    root.childNodes.length === 1 &&
    root.firstChild?.nodeType === Node.ELEMENT_NODE &&
    (root.firstChild as HTMLElement).tagName === "BR";
  if (onlyBreak) return { body: "", caret: 0 };

  let body = "";
  let caret = 0;
  let found = false;

  const mark = (extra: number) => {
    if (found) return;
    caret = body.length + extra;
    found = true;
  };

  const walk = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.dataset.mention) {
        const token = formatMentionToken(Number(el.dataset.mention));
        if (caretNode && (node === caretNode || node.contains(caretNode))) {
          mark(token.length);
        }
        body += token;
        return;
      }
      if (el.tagName === "BR") {
        if (node === caretNode) mark(0);
        body += "\n";
        return;
      }
      if (
        (el.tagName === "DIV" || el.tagName === "P") &&
        body.length > 0 &&
        !body.endsWith("\n")
      ) {
        body += "\n";
      }
      el.childNodes.forEach(walk);
      return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (node === caretNode) mark(caretOffset);
      body += text;
    }
  };

  root.childNodes.forEach(walk);
  if (!found) caret = body.length;
  return { body, caret };
}

function paintComposer(
  root: HTMLElement,
  body: string,
  names: Record<number, string>
) {
  const frag = document.createDocumentFragment();
  for (const token of splitNoteBodyTokens(body)) {
    if (token.type === "mention") {
      const chip = document.createElement("span");
      chip.dataset.mention = String(token.userId);
      chip.contentEditable = "false";
      chip.className = mentionChipClassName;
      chip.textContent = mentionLabel(token.userId, names);
      frag.appendChild(chip);
    } else if (token.value) {
      frag.appendChild(document.createTextNode(token.value));
    }
  }
  root.replaceChildren(frag);
}

function setSerializedCaret(root: HTMLElement, offset: number) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  let remaining = offset;

  const placeAfter = (node: Node) => {
    range.setStartAfter(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const walk = (node: Node): boolean => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.dataset.mention) {
        const token = formatMentionToken(Number(el.dataset.mention));
        if (remaining <= token.length) {
          placeAfter(el);
          return true;
        }
        remaining -= token.length;
        return false;
      }
      if (el.tagName === "BR") {
        if (remaining <= 1) {
          placeAfter(el);
          return true;
        }
        remaining -= 1;
        return false;
      }
      for (const child of node.childNodes) {
        if (walk(child)) return true;
      }
      return false;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (remaining <= text.length) {
        range.setStart(node, remaining);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        return true;
      }
      remaining -= text.length;
    }
    return false;
  };

  if (!walk(root)) {
    range.selectNodeContents(root);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

export function NoteComposer({
  name,
  value,
  names,
  caret,
  placeholder,
  editorRef,
  onValueChange,
  onKeyDown,
  testId,
}: {
  name?: string;
  value: string;
  names: Record<number, string>;
  caret?: number;
  placeholder?: string;
  editorRef?: RefObject<HTMLDivElement | null>;
  onValueChange: (body: string, caret: number) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  testId?: string;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const nodeRef = editorRef ?? innerRef;

  useLayoutEffect(() => {
    const el = nodeRef.current;
    if (!el) return;
    const painted = serializeComposer(el, null, 0).body;
    if (painted === value) return;
    paintComposer(el, value, names);
    if (document.activeElement === el) {
      setSerializedCaret(el, Math.min(caret ?? value.length, value.length));
    }
  }, [caret, names, nodeRef, value]);

  const emit = () => {
    const el = nodeRef.current;
    if (!el) return;
    const selection = window.getSelection();
    const next = serializeComposer(
      el,
      selection?.focusNode ?? null,
      selection?.focusOffset ?? 0
    );
    onValueChange(next.body, next.caret);
  };

  return (
    <div className="relative">
      {name ? <input type="hidden" name={name} value={value} /> : null}
      {!value ? (
        <span className="pointer-events-none absolute top-2 left-2.5 text-sm text-muted-foreground">
          {placeholder}
        </span>
      ) : null}
      <div
        ref={nodeRef}
        role="textbox"
        tabIndex={0}
        aria-multiline="true"
        aria-label={placeholder}
        contentEditable
        suppressContentEditableWarning
        data-testid={testId}
        className={cn(
          "min-h-16 w-full rounded-md border border-input/80 bg-transparent px-2.5 py-2 text-sm whitespace-pre-wrap break-words outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        )}
        onInput={emit}
        onKeyUp={emit}
        onClick={emit}
        onKeyDown={(event) => {
          if (
            (event.metaKey || event.ctrlKey) &&
            ["b", "i", "u"].includes(event.key)
          ) {
            event.preventDefault();
          }
          onKeyDown?.(event);
        }}
        onPaste={(event) => {
          event.preventDefault();
          const text = event.clipboardData?.getData("text/plain") ?? "";
          const selection = window.getSelection();
          if (!selection || selection.rangeCount === 0) return;
          selection.deleteFromDocument();
          selection.getRangeAt(0).insertNode(document.createTextNode(text));
          selection.collapseToEnd();
          emit();
        }}
      />
    </div>
  );
}
