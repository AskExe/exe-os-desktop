import React, { useCallback, useEffect, useRef, useState } from "react";
import { marked } from "marked";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface ChatViewProps {
  employeeName?: string;
  onClose?: () => void;
}

// ---------------------------------------------------------------------------
// Constants — Exe Foundry Bold
// ---------------------------------------------------------------------------

const SURFACE_LOWEST = "#0F0E1A";
const USER_BUBBLE_BG = "#1E1D2E";
const ASSISTANT_BUBBLE_BG = "#16152A";
const GOLD = "#F5D76E";
const ON_SURFACE = "#e4e0f2";
const ON_SURFACE_VARIANT = "#cfc6b1";
const CODE_BG = "#0e0d19";
const CODE_BORDER = "#2a2836";
const INPUT_BG = "#1b1a27";
const INPUT_BORDER = "#2a2836";

const MESSAGE_GAP = 8;
const BUBBLE_PADDING_X = 16;
const BUBBLE_PADDING_Y = 12;
const VIRTUALIZATION_OVERSCAN = 5;

// ---------------------------------------------------------------------------
// Markdown setup — configure marked for safe output
// ---------------------------------------------------------------------------

marked.setOptions({
  breaks: true,
  gfm: true,
});

function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false }) as string;
}

// ---------------------------------------------------------------------------
// Demo messages
// ---------------------------------------------------------------------------

const DEMO_MESSAGES: ChatMessage[] = [
  {
    id: "1",
    role: "user",
    content: "What's the status of the exe-wiki deployment?",
    timestamp: Date.now() - 300000,
  },
  {
    id: "2",
    role: "assistant",
    content: `The exe-wiki deployment is **live** on the VPS at \`askexe.com/demo\`.

### Current Status
- Docker container: **healthy** (port 3001)
- nginx: **active** (proxying to 3001)
- SSL: valid via Cloudflare

### Recent Issues
1. nginx crashed earlier due to a DNS resolution failure in the \`odd-community\` config
2. Fixed by switching \`proxy_pass\` to use a variable for runtime DNS resolution

\`\`\`bash
# Verify it's running
curl -sS https://askexe.com/demo
# HTTP 200
\`\`\`

The demo is fully operational now.`,
    timestamp: Date.now() - 240000,
  },
  {
    id: "3",
    role: "user",
    content: "Can you check disk usage on the VPS?",
    timestamp: Date.now() - 180000,
  },
  {
    id: "4",
    role: "assistant",
    content: `Disk usage is at **93%** — worth monitoring:

| Metric | Value |
|--------|-------|
| Total | 193G |
| Used | 180G |
| Available | 14G |

Not critical yet, but I'd recommend cleaning up old Docker images:

\`\`\`bash
docker system prune -a --volumes
\`\`\`

This should reclaim several GB from unused containers and layers.`,
    timestamp: Date.now() - 120000,
  },
  {
    id: "5",
    role: "user",
    content: "Good call. What about the *theme system* — is that merged?",
    timestamp: Date.now() - 60000,
  },
  {
    id: "6",
    role: "assistant",
    content: `Yes, the theme system is committed as \`5c42708\`:

- **5 themes**: Midnight HQ, Neon Terminal, Lo-fi Study, Orbital Station, Zen Garden
- Each theme has floor HSL shifts, wall colors, accent colors, ambient overlays
- Theme picker is in the **Settings** modal
- Persists via \`localStorage\`
- Default: *Midnight HQ*

All passing — TypeScript clean, esbuild bundles.`,
    timestamp: Date.now(),
  },
];

// ---------------------------------------------------------------------------
// Virtualized message list
// ---------------------------------------------------------------------------

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  const html = renderMarkdown(msg.content);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        paddingLeft: isUser ? 64 : 0,
        paddingRight: isUser ? 0 : 64,
      }}
    >
      <div
        style={{
          background: isUser ? USER_BUBBLE_BG : ASSISTANT_BUBBLE_BG,
          padding: `${BUBBLE_PADDING_Y}px ${BUBBLE_PADDING_X}px`,
          maxWidth: "100%",
          border: `1px solid ${isUser ? "rgba(245, 215, 110, 0.06)" : "rgba(255,255,255,0.03)"}`,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontFamily: "var(--font-label)",
            color: isUser ? GOLD : ON_SURFACE_VARIANT,
            marginBottom: 6,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontWeight: 600,
          }}
        >
          {isUser ? "You" : "exe"}
        </div>
        <div
          className="chat-markdown"
          dangerouslySetInnerHTML={{ __html: html }}
          style={{
            fontSize: 14,
            lineHeight: 1.6,
            color: ON_SURFACE,
            fontFamily: "var(--font-body)",
            wordBreak: "break-word",
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat input
// ---------------------------------------------------------------------------

function ChatInput({ onSend }: { onSend: (text: string) => void }) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue("");
    inputRef.current?.focus();
  }, [value, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div
      style={{
        padding: "12px 16px",
        background: SURFACE_LOWEST,
        borderTop: `1px solid ${INPUT_BORDER}`,
        display: "flex",
        gap: 8,
        alignItems: "flex-end",
      }}
    >
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        rows={1}
        style={{
          flex: 1,
          resize: "none",
          background: INPUT_BG,
          border: `1px solid ${INPUT_BORDER}`,
          color: ON_SURFACE,
          padding: "10px 14px",
          fontSize: 14,
          fontFamily: "var(--font-body)",
          outline: "none",
          lineHeight: 1.5,
          minHeight: 40,
          maxHeight: 120,
        }}
      />
      <button
        onClick={handleSubmit}
        style={{
          background: GOLD,
          color: "#0F0E1A",
          border: "none",
          padding: "10px 20px",
          fontSize: 12,
          fontFamily: "var(--font-label)",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        Send
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main ChatView
// ---------------------------------------------------------------------------

export function ChatView({ employeeName, onClose }: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(DEMO_MESSAGES);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });

  const handleSend = useCallback((text: string) => {
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    setTimeout(() => {
      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: `Acknowledged. Processing: *"${text.slice(0, 60)}${text.length > 60 ? "..." : ""}"*\n\nThis is a demo response. In production, this connects to the exe-os agent system.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    }, 800);
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  // Virtual scroll: update visible range on scroll
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const scrollTop = el.scrollTop;
    const viewportHeight = el.clientHeight;
    const scrollHeight = el.scrollHeight;
    const messageCount = messages.length;

    if (messageCount === 0) return;

    const avgHeight = scrollHeight / messageCount;
    const startIdx = Math.max(0, Math.floor(scrollTop / avgHeight) - VIRTUALIZATION_OVERSCAN);
    const visibleCount = Math.ceil(viewportHeight / avgHeight) + VIRTUALIZATION_OVERSCAN * 2;
    const endIdx = Math.min(messageCount, startIdx + visibleCount);

    setVisibleRange({ start: startIdx, end: endIdx });
  }, [messages.length]);

  // Render only visible messages (+ overscan)
  const visibleMessages =
    messages.length <= 50
      ? messages
      : messages.slice(visibleRange.start, visibleRange.end);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: SURFACE_LOWEST,
        margin: -32,
        marginTop: -32,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          background: "#0e0d19",
          borderBottom: `1px solid ${INPUT_BORDER}`,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            className="material-symbols-outlined"
            style={{ color: GOLD, fontSize: 20 }}
          >
            chat
          </span>
          <span
            style={{
              fontSize: 13,
              fontFamily: "var(--font-headline)",
              fontWeight: 700,
              color: ON_SURFACE,
              textTransform: "uppercase",
              letterSpacing: "-0.01em",
            }}
          >
            {employeeName ? `Chat — ${employeeName}` : "Chat"}
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: ON_SURFACE_VARIANT,
              cursor: "pointer",
              padding: 4,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
              close
            </span>
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "16px 16px",
          display: "flex",
          flexDirection: "column",
          gap: MESSAGE_GAP,
        }}
      >
        {visibleMessages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} />

      {/* Markdown styles */}
      <style>{`
        .chat-markdown p { margin: 0 0 8px 0; }
        .chat-markdown p:last-child { margin-bottom: 0; }
        .chat-markdown h1, .chat-markdown h2, .chat-markdown h3 {
          font-family: var(--font-headline);
          color: ${ON_SURFACE};
          margin: 12px 0 6px 0;
          letter-spacing: -0.02em;
        }
        .chat-markdown h1 { font-size: 18px; }
        .chat-markdown h2 { font-size: 16px; }
        .chat-markdown h3 { font-size: 14px; font-weight: 700; }
        .chat-markdown code {
          font-family: var(--font-label);
          font-size: 12px;
          background: ${CODE_BG};
          border: 1px solid ${CODE_BORDER};
          padding: 2px 6px;
          color: ${GOLD};
        }
        .chat-markdown pre {
          background: ${CODE_BG};
          border: 1px solid ${CODE_BORDER};
          padding: 12px 14px;
          margin: 8px 0;
          overflow-x: auto;
        }
        .chat-markdown pre code {
          background: none;
          border: none;
          padding: 0;
          color: ${ON_SURFACE};
          font-size: 12px;
          line-height: 1.6;
        }
        .chat-markdown ul, .chat-markdown ol {
          padding-left: 20px;
          margin: 6px 0;
        }
        .chat-markdown li { margin: 2px 0; }
        .chat-markdown strong { color: #fff; font-weight: 700; }
        .chat-markdown em { font-style: italic; color: ${ON_SURFACE_VARIANT}; }
        .chat-markdown a {
          color: ${GOLD};
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .chat-markdown table {
          border-collapse: collapse;
          margin: 8px 0;
          width: 100%;
          font-size: 13px;
        }
        .chat-markdown th, .chat-markdown td {
          border: 1px solid ${CODE_BORDER};
          padding: 6px 10px;
          text-align: left;
        }
        .chat-markdown th {
          background: ${CODE_BG};
          font-weight: 700;
          font-family: var(--font-label);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: ${ON_SURFACE_VARIANT};
        }
        .chat-markdown blockquote {
          border-left: 3px solid ${GOLD};
          padding-left: 12px;
          margin: 8px 0;
          color: ${ON_SURFACE_VARIANT};
        }
        .chat-markdown hr {
          border: none;
          border-top: 1px solid ${CODE_BORDER};
          margin: 12px 0;
        }
      `}</style>
    </div>
  );
}
