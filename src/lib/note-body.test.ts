import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  filterMentionUsers,
  MentionPicker,
} from "@/components/notes/mention-picker";
import { NoteBody } from "@/components/notes/note-body";
import {
  escapeNoteHtml,
  extractMentionUserIds,
  firstLine,
  mentionLabel,
  previewLatestNote,
  relativeAge,
  splitNoteBodyTokens,
} from "@/lib/note-body";
import {
  assertAllowedNoteAttachment,
  attachmentContentDisposition,
  NOTE_ATTACHMENT_MAX_BYTES,
} from "@/lib/note-storage";

const XSS = `<script>alert(1)</script><img onerror=alert(1) src=x>`;

describe("note body rendering", () => {
  it("escapes XSS fixtures as inert text", () => {
    const escaped = escapeNoteHtml(XSS);
    expect(escaped).toContain("&lt;script&gt;");
    expect(escaped).not.toContain("<script>");
    expect(escaped).toContain("onerror=alert(1)");
    expect(escaped).not.toMatch(/<img /i);

    const html = renderToStaticMarkup(createElement(NoteBody, { body: XSS }));
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<img /i);
    expect(html).toContain("onerror=alert(1)");
  });

  it("parses @[userId] tokens independently of display name", () => {
    expect(splitNoteBodyTokens("Talked to @[12] today")).toEqual([
      { type: "text", value: "Talked to " },
      { type: "mention", userId: 12 },
      { type: "text", value: " today" },
    ]);
    expect(extractMentionUserIds("@[12] and @[12] and @[9]")).toEqual([12, 9]);
    expect(mentionLabel(12, { 12: "Sarah Chen" })).toBe("@Sarah Chen");
    expect(mentionLabel(10, {})).toBe("@user 10");
  });

  it("builds latest-note preview as author + age + first line", () => {
    const now = new Date("2026-08-17T12:00:00Z");
    expect(
      previewLatestNote({
        authorName: "Sarah Chen",
        createdAt: new Date("2026-08-17T10:00:00Z"),
        body: "Updated drawing due date after talking to this DM\nsecond line",
      })
    ).toContain("Sarah Chen");
    expect(firstLine("Updated drawing due date\nmore")).toBe(
      "Updated drawing due date"
    );
    expect(relativeAge(new Date(now.getTime() - 5 * 60_000), now)).toBe(
      "5m ago"
    );
  });
});

describe("note attachments", () => {
  it("rejects files over 25 MB and accepts any type under the cap", () => {
    expect(() =>
      assertAllowedNoteAttachment(
        "big.pdf",
        "application/pdf",
        NOTE_ATTACHMENT_MAX_BYTES + 1
      )
    ).toThrow(/25 MB/);
    expect(() =>
      assertAllowedNoteAttachment("payload.exe", "application/x-msdownload", 12)
    ).not.toThrow();
    expect(() =>
      assertAllowedNoteAttachment("notes.zip", "application/zip", 2_000)
    ).not.toThrow();
    expect(() =>
      assertAllowedNoteAttachment(
        "edge.pdf",
        "application/pdf",
        NOTE_ATTACHMENT_MAX_BYTES
      )
    ).not.toThrow();
  });

  it("waits for a letter and ranks name prefix matches first", () => {
    const people = [
      { id: 1, name: "Sarah Chen", title: "PCM", region: "Central" },
      { id: 2, name: "Marcus Webb", title: "Estimate Lead", region: "Central" },
      { id: 3, name: "Dana Ortiz", title: "JSA", region: "Texas" },
    ];
    expect(filterMentionUsers(people, "")).toEqual([]);
    expect(filterMentionUsers(people, "@")).toEqual([]);
    expect(filterMentionUsers(people, "s").map((user) => user.name)).toEqual([
      "Sarah Chen",
    ]);
    expect(filterMentionUsers(people, "we").map((user) => user.name)).toEqual([
      "Marcus Webb",
    ]);
  });

  it("mention picker shows an empty state when nobody matches", () => {
    const html = renderToStaticMarkup(
      createElement(MentionPicker, {
        users: [{ id: 1, name: "Sarah Chen", title: "PCM", region: "Central" }],
        query: "zzz",
        activeIndex: 0,
        onPick: () => undefined,
      })
    );
    expect(html).toContain("No matching people");
  });

  it("builds attachment Content-Disposition", () => {
    expect(attachmentContentDisposition('plan "v2".pdf')).toBe(
      'attachment; filename="plan v2.pdf"'
    );
  });
});
