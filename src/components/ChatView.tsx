import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildConversationFrame,
  CODE_BLOCK_PADDING_X,
  CODE_BLOCK_PADDING_Y,
  CODE_LINE_HEIGHT,
  createPreparedChatTemplates,
  findVisibleRange,
  materializeTemplateBlocks,
  type BlockLayout,
  type ChatMessageInstance,
  type ConversationFrame,
  type InlineFragmentLayout,
  type MarkdownChatSeed,
} from "../lib/pretext-chat-model";

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
const HEADER_BG = "#0e0d19";

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
    content: `Disk usage is at **93%** \u2014 worth monitoring:

| Metric | Value |
|--------|-------|
| Total | 193G |
| Used | 180G |
| Available | 14G |

Not critical yet, but I\u2019d recommend cleaning up old Docker images:

\`\`\`bash
docker system prune -a --volumes
\`\`\`

This should reclaim several GB from unused containers and layers.`,
    timestamp: Date.now() - 120000,
  },
  {
    id: "5",
    role: "user",
    content: "Good call. What about the *theme system* \u2014 is that merged?",
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

All passing \u2014 TypeScript clean, esbuild bundles.`,
    timestamp: Date.now(),
  },
];

// ---------------------------------------------------------------------------
// Block renderers — React components for PreText block layouts
// ---------------------------------------------------------------------------

function InlineBlock({
  block,
  contentInsetX,
}: {
  block: Extract<BlockLayout, { kind: "inline" }>;
  contentInsetX: number;
}) {
  return (
    <div
      className="block block--inline"
      style={{ top: block.top, height: block.height }}
    >
      {block.quoteRailLefts.map((left, i) => (
        <div
          key={i}
          className="quote-rail"
          style={{ left: contentInsetX + left }}
        />
      ))}
      {block.markerText !== null &&
        block.markerLeft !== null &&
        block.markerClassName !== null && (
          <span
            className={block.markerClassName}
            style={{
              left: contentInsetX + block.markerLeft,
              top: Math.max(0, Math.round((block.lineHeight - 12) / 2)),
            }}
          >
            {block.markerText}
          </span>
        )}
      {block.lines.map((line, lineIdx) => (
        <div
          key={lineIdx}
          className="line-row"
          style={{
            height: block.lineHeight,
            left: contentInsetX + block.contentLeft,
            top: lineIdx * block.lineHeight,
          }}
        >
          {line.fragments.map((frag, fragIdx) => (
            <InlineFragment key={fragIdx} fragment={frag} />
          ))}
        </div>
      ))}
    </div>
  );
}

function CodeBlock({
  block,
  contentInsetX,
}: {
  block: Extract<BlockLayout, { kind: "code" }>;
  contentInsetX: number;
}) {
  return (
    <div
      className="block block--code-shell"
      style={{ top: block.top, height: block.height }}
    >
      {block.quoteRailLefts.map((left, i) => (
        <div
          key={i}
          className="quote-rail"
          style={{ left: contentInsetX + left }}
        />
      ))}
      {block.markerText !== null &&
        block.markerLeft !== null &&
        block.markerClassName !== null && (
          <span
            className={block.markerClassName}
            style={{
              left: contentInsetX + block.markerLeft,
              top: CODE_BLOCK_PADDING_Y,
            }}
          >
            {block.markerText}
          </span>
        )}
      <div
        className="code-box"
        style={{
          left: contentInsetX + block.contentLeft,
          width: block.width,
          height: block.height,
        }}
      >
        {block.lines.map((line, i) => (
          <div
            key={i}
            className="code-line"
            style={{
              left: CODE_BLOCK_PADDING_X,
              top: CODE_BLOCK_PADDING_Y + i * CODE_LINE_HEIGHT,
            }}
          >
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function RuleBlock({
  block,
  contentInsetX,
}: {
  block: Extract<BlockLayout, { kind: "rule" }>;
  contentInsetX: number;
}) {
  return (
    <div
      className="block block--rule-shell"
      style={{ top: block.top, height: block.height }}
    >
      {block.quoteRailLefts.map((left, i) => (
        <div
          key={i}
          className="quote-rail"
          style={{ left: contentInsetX + left }}
        />
      ))}
      <div
        className="rule-line"
        style={{
          left: contentInsetX + block.contentLeft,
          top: Math.floor(block.height / 2),
          width: block.width,
        }}
      />
    </div>
  );
}

function InlineFragment({ fragment }: { fragment: InlineFragmentLayout }) {
  const style: React.CSSProperties =
    fragment.leadingGap > 0 ? { marginLeft: fragment.leadingGap } : {};

  if (fragment.href !== null) {
    return (
      <a
        className={fragment.className}
        style={style}
        href={fragment.href}
        target="_blank"
        rel="noreferrer"
      >
        {fragment.text}
      </a>
    );
  }

  return (
    <span className={fragment.className} style={style}>
      {fragment.text}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Message row — absolutely positioned with PreText frame data
// ---------------------------------------------------------------------------

function MessageRow({
  instance,
  blocks,
  role,
  employeeName,
}: {
  instance: ChatMessageInstance;
  blocks: BlockLayout[];
  role: "user" | "assistant";
  employeeName: string;
}) {
  const isUser = role === "user";
  const contentInsetX = instance.frame.contentInsetX;

  return (
    <article
      className={`msg msg--${role}`}
      style={{ top: instance.top, height: instance.frame.totalHeight }}
    >
      <div
        className="msg-bubble"
        style={{
          width: instance.frame.frameWidth,
          height: instance.frame.bubbleHeight,
        }}
      >
        {/* Role label */}
        <div
          className="msg-role-label"
          style={{
            left: contentInsetX,
            color: isUser ? GOLD : ON_SURFACE_VARIANT,
          }}
        >
          {isUser ? "You" : employeeName}
        </div>
        {/* Blocks are offset to account for the role label */}
        <div
          className="msg-blocks"
          style={{ top: 18 }}
        >
          {blocks.map((block, i) => {
            switch (block.kind) {
              case "inline":
                return (
                  <InlineBlock
                    key={i}
                    block={block}
                    contentInsetX={contentInsetX}
                  />
                );
              case "code":
                return (
                  <CodeBlock
                    key={i}
                    block={block}
                    contentInsetX={contentInsetX}
                  />
                );
              case "rule":
                return (
                  <RuleBlock
                    key={i}
                    block={block}
                    contentInsetX={contentInsetX}
                  />
                );
            }
          })}
        </div>
      </div>
    </article>
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
    [handleSubmit],
  );

  return (
    <div className="chat-input-bar">
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        rows={1}
        className="chat-input-field"
      />
      <button onClick={handleSubmit} className="chat-send-btn">
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
  const [fontsReady, setFontsReady] = useState(false);
  const [chatWidth, setChatWidth] = useState(388);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const viewportRef = useRef<HTMLDivElement>(null);
  const rafId = useRef<number | null>(null);
  const autoScrollRef = useRef(true);
  const displayName = employeeName ?? "exe";

  // Wait for fonts before measuring
  useEffect(() => {
    document.fonts.ready.then(() => setFontsReady(true));
  }, []);

  // Prepare templates from messages
  const seeds: MarkdownChatSeed[] = useMemo(
    () => messages.map((m) => ({ role: m.role, markdown: m.content })),
    [messages],
  );

  const templates = useMemo(
    () => (fontsReady ? createPreparedChatTemplates(seeds) : []),
    [seeds, fontsReady],
  );

  // Build conversation frame
  const frame: ConversationFrame | null = useMemo(
    () =>
      templates.length > 0
        ? buildConversationFrame(templates, chatWidth)
        : null,
    [templates, chatWidth],
  );

  // Find visible range
  const { start, end } = useMemo(
    () =>
      frame !== null
        ? findVisibleRange(frame, scrollTop, viewportHeight)
        : { start: 0, end: 0 },
    [frame, scrollTop, viewportHeight],
  );

  // Materialize visible blocks
  const visibleEntries = useMemo(() => {
    if (frame === null) return [];
    const entries: Array<{
      index: number;
      instance: ChatMessageInstance;
      blocks: BlockLayout[];
      message: ChatMessage;
    }> = [];
    for (let i = start; i < end; i++) {
      const inst = frame.messages[i];
      const msg = messages[i];
      if (inst && msg) {
        entries.push({
          index: i,
          instance: inst,
          blocks: materializeTemplateBlocks(inst),
          message: msg,
        });
      }
    }
    return entries;
  }, [frame, start, end, messages]);

  // rAF-throttled scroll handler
  const handleScroll = useCallback(() => {
    if (rafId.current !== null) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      const el = viewportRef.current;
      if (!el) return;
      setScrollTop(el.scrollTop);
      setViewportHeight(el.clientHeight);

      // Track whether user is near bottom for auto-scroll
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      autoScrollRef.current = distanceFromBottom < 40;
    });
  }, []);

  // ResizeObserver for width + height tracking
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setChatWidth(entry.contentRect.width);
        setViewportHeight(entry.contentRect.height);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Auto-scroll to bottom on new messages (if user was near bottom)
  useEffect(() => {
    if (!autoScrollRef.current) return;
    const el = viewportRef.current;
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [messages.length, frame?.totalHeight]);

  // Send handler
  const handleSend = useCallback((text: string) => {
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    autoScrollRef.current = true;

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

  return (
    <div className="chat-view">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <span
            className="material-symbols-outlined"
            style={{ color: GOLD, fontSize: 20 }}
          >
            chat
          </span>
          <span className="chat-header-title">
            {employeeName ? `Chat \u2014 ${employeeName}` : "Chat"}
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} className="chat-close-btn">
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 20 }}
            >
              close
            </span>
          </button>
        )}
      </div>

      {/* Virtualized message viewport */}
      <div
        ref={viewportRef}
        className="chat-viewport"
        onScroll={handleScroll}
      >
        <div
          className="chat-canvas"
          style={{ height: frame?.totalHeight ?? 0 }}
        >
          {visibleEntries.map((entry) => (
            <MessageRow
              key={entry.message.id}
              instance={entry.instance}
              blocks={entry.blocks}
              role={entry.message.role}
              employeeName={displayName}
            />
          ))}
        </div>
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} />

      {/* PreText chat styles — Exe Foundry Bold */}
      <style>{`
        .chat-view {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: ${SURFACE_LOWEST};
          margin: -32px;
        }

        /* Header */
        .chat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: ${HEADER_BG};
          border-bottom: 1px solid ${INPUT_BORDER};
          flex-shrink: 0;
        }
        .chat-header-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .chat-header-title {
          font-size: 13px;
          font-family: var(--font-headline);
          font-weight: 700;
          color: ${ON_SURFACE};
          text-transform: uppercase;
          letter-spacing: -0.01em;
        }
        .chat-close-btn {
          background: transparent;
          border: none;
          color: ${ON_SURFACE_VARIANT};
          cursor: pointer;
          padding: 4px;
        }

        /* Viewport + Canvas */
        .chat-viewport {
          flex: 1;
          overflow: auto;
          position: relative;
        }
        .chat-canvas {
          position: relative;
          width: 100%;
          min-height: 100%;
        }

        /* Message rows */
        .msg {
          position: absolute;
          left: 0;
          width: 100%;
          padding-inline: 12px;
          display: flex;
        }
        .msg--assistant { justify-content: flex-start; }
        .msg--user { justify-content: flex-end; }

        /* Bubble */
        .msg-bubble {
          position: relative;
          flex: 0 0 auto;
          max-width: 100%;
        }
        .msg--user .msg-bubble {
          background: ${USER_BUBBLE_BG};
          border: 1px solid rgba(245, 215, 110, 0.06);
        }
        .msg--assistant .msg-bubble {
          background: ${ASSISTANT_BUBBLE_BG};
          border: 1px solid rgba(255, 255, 255, 0.03);
        }

        /* Role label */
        .msg-role-label {
          position: absolute;
          top: 8px;
          font-size: 10px;
          font-family: var(--font-label);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 600;
        }

        /* Blocks container offset for role label */
        .msg-blocks {
          position: relative;
        }

        /* Block base */
        .block {
          position: absolute;
          left: 0;
          width: 100%;
        }

        /* Quote rails */
        .quote-rail {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 3px;
          background: rgba(207, 198, 177, 0.18);
        }

        /* List markers */
        .block-marker {
          position: absolute;
          white-space: pre;
          color: ${ON_SURFACE_VARIANT};
          font: 600 11px "Space Grotesk", sans-serif;
        }
        .block-marker--task { color: ${ON_SURFACE_VARIANT}; }

        /* Line rows */
        .line-row {
          position: absolute;
          display: flex;
          align-items: center;
          gap: 0;
          width: max-content;
        }

        /* Inline fragments */
        .frag {
          display: inline-block;
          white-space: pre;
          line-height: 1;
          color: ${ON_SURFACE};
          vertical-align: baseline;
        }
        .frag--body {
          font: 400 14px Manrope, sans-serif;
        }
        .frag--heading-1 {
          font: 700 18px Epilogue, sans-serif;
          letter-spacing: -0.02em;
          color: #fff;
        }
        .frag--heading-2 {
          font: 700 16px Epilogue, sans-serif;
          letter-spacing: -0.02em;
          color: #fff;
        }
        .frag--code {
          padding: 2px 6px 3px;
          background: ${CODE_BG};
          border: 1px solid ${CODE_BORDER};
          font: 600 12px "Space Grotesk", sans-serif;
          color: ${GOLD};
        }
        .frag--chip {
          display: inline-flex;
          align-items: center;
          padding: 0 7px;
          min-height: 18px;
          background: ${CODE_BG};
          border: 1px solid ${CODE_BORDER};
          color: ${GOLD};
          font: 700 11px Manrope, sans-serif;
          transform: translateY(1px);
        }
        .is-link {
          color: ${GOLD};
          text-decoration: underline;
          text-decoration-thickness: 1px;
          text-underline-offset: 0.14em;
        }
        .is-em { font-style: italic; }
        .is-strong { font-weight: 700; color: #fff; }
        .is-del {
          text-decoration: line-through;
          text-decoration-thickness: 1px;
        }

        /* Code blocks */
        .code-box {
          position: absolute;
          top: 0;
          background: ${CODE_BG};
          border: 1px solid ${CODE_BORDER};
        }
        .code-line {
          position: absolute;
          white-space: pre;
          font: 500 12px/18px "Space Grotesk", sans-serif;
          color: ${ON_SURFACE};
        }

        /* Rule */
        .rule-line {
          position: absolute;
          height: 1px;
          background: ${CODE_BORDER};
        }

        /* Input bar */
        .chat-input-bar {
          padding: 12px 16px;
          background: ${SURFACE_LOWEST};
          border-top: 1px solid ${INPUT_BORDER};
          display: flex;
          gap: 8px;
          align-items: flex-end;
          flex-shrink: 0;
        }
        .chat-input-field {
          flex: 1;
          resize: none;
          background: ${INPUT_BG};
          border: 1px solid ${INPUT_BORDER};
          color: ${ON_SURFACE};
          padding: 10px 14px;
          font-size: 14px;
          font-family: var(--font-body);
          outline: none;
          line-height: 1.5;
          min-height: 40px;
          max-height: 120px;
        }
        .chat-send-btn {
          background: ${GOLD};
          color: #0F0E1A;
          border: none;
          padding: 10px 20px;
          font-size: 12px;
          font-family: var(--font-label);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          cursor: pointer;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}
