import { describe, expect, it } from "vitest";
import {
  conversationTitle,
  emptyConversation,
  loadCopilotHistory,
  saveCopilotHistory,
  slimMessages,
  upsertConversation,
} from "@/lib/copilot-history";

const user = {
  id: "u1",
  role: "user" as const,
  parts: [
    {
      type: "text",
      text: "Which upcoming efforts in my region have no team assigned?",
    },
  ],
};

describe("copilot history", () => {
  it("titles a thread from the first user message", () => {
    expect(conversationTitle([user])).toBe(
      "Which upcoming efforts in my region have no team assigned?"
    );
  });

  it("keeps the latest conversation first and drops empty drafts", () => {
    const first = upsertConversation(
      { activeId: "a", conversations: [] },
      { id: "a", title: "New chat", updatedAt: 1, messages: [user] }
    );
    const draft = emptyConversation("b");
    const withDraft = upsertConversation(first, draft);
    expect(withDraft.conversations.map((row) => row.id)).toEqual(["a"]);
    expect(withDraft.activeId).toBe("b");
  });

  it("returns a cached snapshot so the store hook does not loop", () => {
    const store = upsertConversation(
      { activeId: "a", conversations: [] },
      { id: "a", title: "New chat", updatedAt: 1, messages: [user] }
    );
    saveCopilotHistory(9, store);
    expect(loadCopilotHistory(9)).toBe(loadCopilotHistory(9));
  });

  it("caps stored tool rows so history stays small", () => {
    const rows = Array.from({ length: 40 }, (_, index) => ({
      jobNumber: String(index),
    }));
    const slim = slimMessages([
      {
        id: "a1",
        role: "assistant",
        parts: [{ type: "tool-query_needs_staffing", output: rows }],
      },
    ]);
    const output = slim[0]?.parts[0]?.output;
    expect(Array.isArray(output) ? output.length : -1).toBe(24);
  });
});
