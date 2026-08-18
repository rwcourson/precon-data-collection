export type CopilotHistoryMessage = {
  id: string;
  role: "user" | "assistant";
  parts: Array<Record<string, unknown>>;
};

export type CopilotConversation = {
  id: string;
  title: string;
  updatedAt: number;
  messages: CopilotHistoryMessage[];
};

export type CopilotHistoryStore = {
  activeId: string;
  conversations: CopilotConversation[];
};

export const COPILOT_HISTORY_LIMIT = 30;

function storageKey(userId: number) {
  return `precon.copilot.history.v1.${userId}`;
}

export function newConversationId() {
  return `chat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyConversation(id = newConversationId()): CopilotConversation {
  return { id, title: "New chat", updatedAt: Date.now(), messages: [] };
}

export function conversationTitle(messages: CopilotHistoryMessage[]): string {
  for (const message of messages) {
    if (message.role !== "user") continue;
    const text = message.parts
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => String(part.text).trim())
      .join(" ");
    if (text) return text.length > 64 ? `${text.slice(0, 63)}…` : text;
  }
  return "New chat";
}

function slimPart(part: Record<string, unknown>): Record<string, unknown> {
  const output = part.output ?? part.result;
  if (!Array.isArray(output)) return part;
  return { ...part, output: output.slice(0, 24), result: undefined };
}

export function slimMessages(messages: CopilotHistoryMessage[]): CopilotHistoryMessage[] {
  return messages.slice(-80).map((message) => ({
    ...message,
    parts: message.parts.map(slimPart),
  }));
}

export function upsertConversation(
  store: CopilotHistoryStore,
  conversation: CopilotConversation,
): CopilotHistoryStore {
  const next = {
    ...conversation,
    title: conversationTitle(conversation.messages),
    updatedAt: Date.now(),
    messages: slimMessages(conversation.messages),
  };
  const rest = store.conversations.filter((row) => row.id !== next.id);
  const conversations = next.messages.length > 0 ? [next, ...rest] : rest;
  return {
    activeId: next.id,
    conversations: conversations.slice(0, COPILOT_HISTORY_LIMIT),
  };
}

export function loadCopilotHistory(userId: number): CopilotHistoryStore {
  const fallback = { activeId: newConversationId(), conversations: [] as CopilotConversation[] };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as CopilotHistoryStore;
    if (!parsed || !Array.isArray(parsed.conversations)) return fallback;
    const conversations = parsed.conversations.filter(
      (row) => row && typeof row.id === "string" && Array.isArray(row.messages),
    );
    const activeId =
      conversations.some((row) => row.id === parsed.activeId) && parsed.activeId
        ? parsed.activeId
        : (conversations[0]?.id ?? fallback.activeId);
    return { activeId, conversations };
  } catch {
    return fallback;
  }
}

export function saveCopilotHistory(userId: number, store: CopilotHistoryStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(userId), JSON.stringify(store));
}
