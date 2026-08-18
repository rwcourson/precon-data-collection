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
export const EMPTY_COPILOT_HISTORY: CopilotHistoryStore = {
  activeId: "",
  conversations: [],
};

function storageKey(userId: number) {
  return `precon.copilot.history.v1.${userId}`;
}

const listeners = new Map<number, Set<() => void>>();
const snapshots = new Map<
  number,
  { raw: string; store: CopilotHistoryStore }
>();

function parseStore(raw: string, fallbackId: string): CopilotHistoryStore {
  try {
    const parsed = JSON.parse(raw) as CopilotHistoryStore;
    if (!parsed || !Array.isArray(parsed.conversations)) {
      return { activeId: fallbackId, conversations: [] };
    }
    const conversations = parsed.conversations.filter(
      (row) => row && typeof row.id === "string" && Array.isArray(row.messages)
    );
    const activeId =
      conversations.some((row) => row.id === parsed.activeId) && parsed.activeId
        ? parsed.activeId
        : (conversations[0]?.id ?? fallbackId);
    return { activeId, conversations };
  } catch {
    return { activeId: fallbackId, conversations: [] };
  }
}

function notify(userId: number) {
  for (const listener of listeners.get(userId) ?? []) listener();
}

export function subscribeCopilotHistory(userId: number, onChange: () => void) {
  let set = listeners.get(userId);
  if (!set) {
    set = new Set();
    listeners.set(userId, set);
  }
  set.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey(userId)) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    set.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function newConversationId() {
  return `chat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyConversation(
  id = newConversationId()
): CopilotConversation {
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

export function slimMessages(
  messages: CopilotHistoryMessage[]
): CopilotHistoryMessage[] {
  return messages.slice(-80).map((message) => ({
    ...message,
    parts: message.parts.map(slimPart),
  }));
}

export function upsertConversation(
  store: CopilotHistoryStore,
  conversation: CopilotConversation
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
  if (typeof window === "undefined") return EMPTY_COPILOT_HISTORY;
  const raw = window.localStorage.getItem(storageKey(userId)) ?? "";
  const cached = snapshots.get(userId);
  if (cached && cached.raw === raw) return cached.store;
  const store = raw
    ? parseStore(raw, cached?.store.activeId || newConversationId())
    : {
        activeId: cached?.store.activeId || newConversationId(),
        conversations: [],
      };
  snapshots.set(userId, { raw, store });
  return store;
}

export function saveCopilotHistory(userId: number, store: CopilotHistoryStore) {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify(store);
  window.localStorage.setItem(storageKey(userId), raw);
  snapshots.set(userId, { raw, store });
  notify(userId);
}
