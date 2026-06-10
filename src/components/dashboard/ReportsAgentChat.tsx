"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Role = "user" | "assistant";
type ChatMessage = { role: Role; content: string };

type Range = { from: string; to: string };

const SUGGESTIONS = [
  "What were my top sellers?",
  "How did payment methods break down?",
  "Which day had the highest sales?",
  "Any concerns in this period?",
];

// Chat history is persisted per restaurant so it survives navigation/reload.
const storageKey = (restaurantId: string) => `rms.reports.chat.${restaurantId}`;

function loadHistory(restaurantId: string): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(restaurantId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is ChatMessage =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.length > 0,
    );
  } catch {
    return [];
  }
}

export function ReportsAgentChat({
  restaurantId,
  branchName,
  range,
  report,
  onClose,
}: {
  restaurantId: string;
  branchName: string | null;
  range: Range;
  report: unknown;
  onClose?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load this restaurant's saved conversation (and reload when it changes).
  useEffect(() => {
    setMessages(loadHistory(restaurantId));
    setError(null);
    setInput("");
  }, [restaurantId]);

  // Persist imperatively at real mutation points (not via an effect on
  // `messages` — that would wipe saved history with the initial empty state
  // on mount, before the load above applies). Writes go to the restaurant the
  // conversation belongs to, captured in `restaurantId` at call time.
  const persist = useCallback(
    (msgs: ChatMessage[]) => {
      if (typeof window === "undefined") return;
      try {
        if (msgs.length) {
          window.localStorage.setItem(
            storageKey(restaurantId),
            JSON.stringify(msgs),
          );
        } else {
          window.localStorage.removeItem(storageKey(restaurantId));
        }
      } catch {
        /* quota or disabled storage — chat still works in-memory */
      }
    },
    [restaurantId],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setError(null);
    setInput("");

    const history: ChatMessage[] = [...messages, { role: "user", content: question }];
    // Add the user message + an empty assistant slot we stream into.
    setMessages([...history, { role: "assistant", content: "" }]);
    setBusy(true);

    try {
      const res = await fetch("/api/reports/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchName, range, report, messages: history }),
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        let message = "The agent could not answer. Please try again.";
        try {
          const json = JSON.parse(text);
          if (json?.error?.message) message = json.error.message;
        } catch {
          /* non-JSON body */
        }
        throw new Error(message);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: acc };
          return next;
        });
      }
      // Save the completed exchange for this restaurant.
      persist([...history, { role: "assistant", content: acc }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      // Drop the empty assistant placeholder on failure, and keep the
      // question in saved history so it survives a reload.
      setMessages((prev) => {
        const next = [...prev];
        if (next.length && next[next.length - 1].role === "assistant" && !next[next.length - 1].content) {
          next.pop();
        }
        persist(next);
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="card"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 140px)",
        position: "sticky",
        top: 0,
        padding: 0,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 18px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div className="h-2" style={{ fontSize: 16 }}>
            Ask agent
          </div>
          <div className="eyebrow" style={{ marginTop: 2 }}>
            ABOUT THIS REPORT
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                setError(null);
                persist([]);
              }}
              disabled={busy}
              title="Start a new conversation"
              style={{
                fontSize: 12,
                color: "var(--text-3)",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "4px 10px",
                cursor: busy ? "default" : "pointer",
              }}
            >
              New session
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Hide chat"
              title="Hide chat"
              style={{
                fontSize: 16,
                lineHeight: 1,
                color: "var(--text-2)",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: 8,
                width: 28,
                height: 28,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{ flex: 1, overflowY: "auto", padding: 18, minHeight: 0 }}
      >
        {messages.length === 0 ? (
          <div className="col" style={{ gap: 10 }}>
            <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}>
              Ask about sales, top items, payment methods, shifts, or trends for
              the selected range.
            </p>
            <div className="col" style={{ gap: 8, marginTop: 4 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  style={{
                    textAlign: "left",
                    fontSize: 13,
                    color: "var(--text)",
                    background: "var(--bg-elev)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: "9px 12px",
                    cursor: "pointer",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="col" style={{ gap: 14 }}>
            {messages.map((m, i) => (
              <ChatBubble
                key={i}
                role={m.role}
                content={m.content}
                pending={
                  busy && i === messages.length - 1 && m.role === "assistant" && !m.content
                }
              />
            ))}
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: 12,
              fontSize: 13,
              color: "var(--coral)",
              border: "1px solid var(--coral)",
              borderRadius: 10,
              padding: "8px 12px",
              background: "color-mix(in oklab, var(--coral) 10%, transparent)",
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        style={{
          padding: 14,
          borderTop: "1px solid var(--border)",
          display: "flex",
          gap: 8,
          alignItems: "flex-end",
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          placeholder="Ask about this report…"
          rows={1}
          style={{
            flex: 1,
            resize: "none",
            maxHeight: 120,
            fontSize: 13,
            lineHeight: 1.4,
            padding: "9px 12px",
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--bg-elev)",
            color: "var(--text)",
            outline: "none",
            fontFamily: "inherit",
          }}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          style={{
            fontSize: 13,
            fontWeight: 600,
            padding: "9px 14px",
            borderRadius: 10,
            border: "none",
            background: busy || !input.trim() ? "var(--bg-elev)" : "var(--clay-500, var(--coral))",
            color: busy || !input.trim() ? "var(--text-3)" : "#fff",
            cursor: busy || !input.trim() ? "default" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {busy ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}

function ChatBubble({
  role,
  content,
  pending,
}: {
  role: Role;
  content: string;
  pending: boolean;
}) {
  const isUser = role === "user";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
      }}
    >
      <div
        style={{
          maxWidth: "88%",
          fontSize: 13,
          lineHeight: 1.55,
          padding: "9px 13px",
          borderRadius: 14,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          background: isUser ? "var(--clay-500, var(--coral))" : "var(--bg-elev)",
          color: isUser ? "#fff" : "var(--text)",
          border: isUser ? "none" : "1px solid var(--border)",
          borderBottomRightRadius: isUser ? 4 : 14,
          borderBottomLeftRadius: isUser ? 14 : 4,
        }}
      >
        {pending ? <TypingDots /> : content}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 4, padding: "2px 0" }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--text-3)",
            animation: `rms-bounce 1s ${i * 0.15}s infinite ease-in-out`,
          }}
        />
      ))}
      <style>{`@keyframes rms-bounce {0%,80%,100%{opacity:.3;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}`}</style>
    </span>
  );
}
