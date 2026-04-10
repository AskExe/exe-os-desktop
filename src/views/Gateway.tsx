import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Platform = "whatsapp" | "email" | "webhook";
type PlatformFilter = "all" | Platform;

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  direction: "incoming" | "outgoing";
  platform: Platform;
}

interface Conversation {
  id: string;
  senderName: string;
  senderHandle: string;
  platform: Platform;
  lastMessage: string;
  lastMessageTime: string;
  unread: number;
  status: "active" | "resolved";
  messages: Message[];
}

interface GatewayAgent {
  name: string;
  status: "online" | "busy" | "offline";
  activeConversations: number;
  modelTier: "haiku" | "sonnet" | "opus";
}

interface RouteRule {
  id: string;
  platform: Platform;
  channelPattern: string;
  assignedAgent: string;
  modelTier: "haiku" | "sonnet" | "opus";
  isDefault?: boolean;
}

interface GatewayData {
  conversations: Conversation[];
  agents: GatewayAgent[];
  routes: RouteRule[];
}

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

const DEMO_CONVERSATIONS: Conversation[] = [
  {
    id: "c1",
    senderName: "Sarah Chen",
    senderHandle: "+1 (415) 555-0142",
    platform: "whatsapp",
    lastMessage: "Can you check the status of my last order?",
    lastMessageTime: "2026-04-10T08:42:00Z",
    unread: 2,
    status: "active",
    messages: [
      { id: "m1", sender: "Sarah Chen", content: "Hi, I placed an order last week and haven't received tracking info yet.", timestamp: "2026-04-10T08:35:00Z", direction: "incoming", platform: "whatsapp" },
      { id: "m2", sender: "exe-gateway", content: "I can help with that. Let me look up your order. Could you share your order number?", timestamp: "2026-04-10T08:36:00Z", direction: "outgoing", platform: "whatsapp" },
      { id: "m3", sender: "Sarah Chen", content: "It's ORD-20260403-7821", timestamp: "2026-04-10T08:38:00Z", direction: "incoming", platform: "whatsapp" },
      { id: "m4", sender: "exe-gateway", content: "Found it. Your order shipped on April 8th via FedEx. Tracking number: FX-9284710384. Estimated delivery is April 11th.", timestamp: "2026-04-10T08:39:00Z", direction: "outgoing", platform: "whatsapp" },
      { id: "m5", sender: "Sarah Chen", content: "Can you check the status of my last order?", timestamp: "2026-04-10T08:42:00Z", direction: "incoming", platform: "whatsapp" },
    ],
  },
  {
    id: "c2",
    senderName: "James Wright",
    senderHandle: "james@acme-corp.com",
    platform: "email",
    lastMessage: "Following up on the API integration timeline",
    lastMessageTime: "2026-04-10T08:30:00Z",
    unread: 1,
    status: "active",
    messages: [
      { id: "m6", sender: "James Wright", content: "Hi team,\n\nWe discussed the API integration during last week's call. Could you provide an updated timeline for the v2 endpoints? Our engineering team is planning their Q2 sprint around this.", timestamp: "2026-04-10T07:15:00Z", direction: "incoming", platform: "email" },
      { id: "m7", sender: "exe-gateway", content: "Hi James,\n\nThe v2 API endpoints are on track. Here's the current timeline:\n- Auth endpoints: shipped (April 5)\n- Data sync endpoints: April 14\n- Webhook callbacks: April 18\n\nI'll send a detailed spec doc by end of week.", timestamp: "2026-04-10T07:22:00Z", direction: "outgoing", platform: "email" },
      { id: "m8", sender: "James Wright", content: "Following up on the API integration timeline", timestamp: "2026-04-10T08:30:00Z", direction: "incoming", platform: "email" },
    ],
  },
  {
    id: "c3",
    senderName: "Support Bot",
    senderHandle: "webhook://zendesk/ticket-4892",
    platform: "webhook",
    lastMessage: "Ticket #4892 escalated — customer waiting 48h",
    lastMessageTime: "2026-04-10T08:15:00Z",
    unread: 0,
    status: "active",
    messages: [
      { id: "m9", sender: "Support Bot", content: "Ticket #4892 escalated — customer waiting 48h. Subject: 'Cannot export reports to PDF'. Priority: High.", timestamp: "2026-04-10T08:15:00Z", direction: "incoming", platform: "webhook" },
      { id: "m10", sender: "exe-gateway", content: "Acknowledged. Investigating PDF export issue. This appears related to the rendering service update from April 8. Routing to engineering.", timestamp: "2026-04-10T08:16:00Z", direction: "outgoing", platform: "webhook" },
    ],
  },
  {
    id: "c4",
    senderName: "Maria Lopez",
    senderHandle: "+52 55 1234 5678",
    platform: "whatsapp",
    lastMessage: "Gracias, todo resuelto!",
    lastMessageTime: "2026-04-10T07:50:00Z",
    unread: 0,
    status: "resolved",
    messages: [
      { id: "m11", sender: "Maria Lopez", content: "Hola, tengo un problema con mi cuenta. No puedo iniciar sesion.", timestamp: "2026-04-10T07:30:00Z", direction: "incoming", platform: "whatsapp" },
      { id: "m12", sender: "exe-gateway", content: "Hola Maria. Veo que tu cuenta fue bloqueada por intentos de login fallidos. Ya la desbloquee. Intenta iniciar sesion de nuevo.", timestamp: "2026-04-10T07:32:00Z", direction: "outgoing", platform: "whatsapp" },
      { id: "m13", sender: "Maria Lopez", content: "Gracias, todo resuelto!", timestamp: "2026-04-10T07:50:00Z", direction: "incoming", platform: "whatsapp" },
    ],
  },
  {
    id: "c5",
    senderName: "DevOps Alert",
    senderHandle: "webhook://pagerduty/inc-2847",
    platform: "webhook",
    lastMessage: "Incident INC-2847 resolved — DB replica lag cleared",
    lastMessageTime: "2026-04-10T06:45:00Z",
    unread: 0,
    status: "resolved",
    messages: [
      { id: "m14", sender: "DevOps Alert", content: "INCIDENT INC-2847: DB replica lag exceeding 30s threshold. Primary: us-east-1. Affected: read replicas us-west-2.", timestamp: "2026-04-10T06:10:00Z", direction: "incoming", platform: "webhook" },
      { id: "m15", sender: "exe-gateway", content: "Acknowledged. Checking replication status. Replica lag was caused by a long-running migration on the primary. Migration completed at 06:38 UTC. Lag clearing.", timestamp: "2026-04-10T06:20:00Z", direction: "outgoing", platform: "webhook" },
      { id: "m16", sender: "DevOps Alert", content: "Incident INC-2847 resolved — DB replica lag cleared", timestamp: "2026-04-10T06:45:00Z", direction: "incoming", platform: "webhook" },
    ],
  },
  {
    id: "c6",
    senderName: "Alex Rivera",
    senderHandle: "alex.rivera@startup.io",
    platform: "email",
    lastMessage: "Re: Partnership proposal — let's schedule a call",
    lastMessageTime: "2026-04-10T05:20:00Z",
    unread: 0,
    status: "resolved",
    messages: [
      { id: "m17", sender: "Alex Rivera", content: "Hi,\n\nI'm the CTO at Startup.io. We're interested in integrating exe-os into our developer platform. Would love to discuss a partnership. Are you available for a call this week?", timestamp: "2026-04-09T22:00:00Z", direction: "incoming", platform: "email" },
      { id: "m18", sender: "exe-gateway", content: "Hi Alex,\n\nThanks for reaching out. I've forwarded your proposal to the founder with a summary. Someone will follow up to schedule a call within 24h.", timestamp: "2026-04-09T22:05:00Z", direction: "outgoing", platform: "email" },
      { id: "m19", sender: "Alex Rivera", content: "Re: Partnership proposal — let's schedule a call", timestamp: "2026-04-10T05:20:00Z", direction: "incoming", platform: "email" },
    ],
  },
];

const DEMO_AGENTS: GatewayAgent[] = [
  { name: "gateway-alpha", status: "online", activeConversations: 3, modelTier: "sonnet" },
  { name: "gateway-beta", status: "busy", activeConversations: 2, modelTier: "haiku" },
  { name: "gateway-gamma", status: "offline", activeConversations: 0, modelTier: "opus" },
];

const DEMO_ROUTES: RouteRule[] = [
  { id: "r1", platform: "whatsapp", channelPattern: "+1*", assignedAgent: "gateway-alpha", modelTier: "sonnet" },
  { id: "r2", platform: "whatsapp", channelPattern: "+52*", assignedAgent: "gateway-beta", modelTier: "haiku" },
  { id: "r3", platform: "email", channelPattern: "*@acme-corp.com", assignedAgent: "gateway-alpha", modelTier: "sonnet" },
  { id: "r4", platform: "webhook", channelPattern: "pagerduty/*", assignedAgent: "gateway-gamma", modelTier: "opus" },
  { id: "r5", platform: "webhook", channelPattern: "*", assignedAgent: "gateway-beta", modelTier: "haiku", isDefault: true },
];

// ---------------------------------------------------------------------------
// Data hook — swap this for real WS data later
// ---------------------------------------------------------------------------

function useGatewayData(): GatewayData {
  return useMemo(() => ({
    conversations: DEMO_CONVERSATIONS,
    agents: DEMO_AGENTS,
    routes: DEMO_ROUTES,
  }), []);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PLATFORM_ICON: Record<Platform, string> = {
  whatsapp: "chat",
  email: "mail",
  webhook: "webhook",
};

const PLATFORM_LABEL: Record<Platform, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  webhook: "Webhook",
};

const PLATFORM_COLOR: Record<Platform, string> = {
  whatsapp: "#22C55E",
  email: "#dec1ac",
  webhook: "#ffb4a8",
};

const AGENT_STATUS_COLOR: Record<GatewayAgent["status"], string> = {
  online: "#22C55E",
  busy: "#F5D76E",
  offline: "#98907d",
};

const MODEL_TIER_COLOR: Record<string, string> = {
  haiku: "#98907d",
  sonnet: "#dec1ac",
  opus: "#F5D76E",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = {
  container: {
    display: "flex",
    height: "100%",
    margin: -32,
    overflow: "hidden",
  },
  // Left panel
  leftPanel: {
    width: 280,
    background: "var(--surface-low)",
    display: "flex",
    flexDirection: "column" as const,
    flexShrink: 0,
    overflow: "hidden",
  },
  filterBar: {
    display: "flex",
    gap: 0,
    borderBottom: "1px solid var(--outline-variant)",
  },
  filterTab: (active: boolean) => ({
    flex: 1,
    padding: "10px 0",
    fontFamily: "var(--font-label)",
    fontSize: 11,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    textAlign: "center" as const,
    color: active ? "var(--primary-container)" : "var(--outline)",
    background: active ? "var(--surface-high)" : "transparent",
    borderBottom: active ? "2px solid var(--primary-container)" : "2px solid transparent",
    cursor: "pointer",
    border: "none",
    borderBottomWidth: 2,
    borderBottomStyle: "solid" as const,
    borderBottomColor: active ? "var(--primary-container)" : "transparent",
  }),
  searchBox: {
    padding: 8,
    borderBottom: "1px solid var(--outline-variant)",
  },
  searchInput: {
    width: "100%",
    background: "var(--surface-lowest)",
    border: "none",
    padding: "8px 12px",
    fontFamily: "var(--font-body)",
    fontSize: 13,
    color: "var(--on-surface)",
    outline: "none",
  },
  conversationList: {
    flex: 1,
    overflow: "auto",
  },
  conversationItem: (active: boolean) => ({
    display: "flex",
    gap: 10,
    padding: "12px 12px",
    cursor: "pointer",
    background: active ? "var(--surface-high)" : "transparent",
    borderLeft: active ? "3px solid var(--primary-container)" : "3px solid transparent",
    transition: "background 0.1s",
  }),
  convContent: {
    flex: 1,
    minWidth: 0,
  },
  convHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  convName: {
    fontFamily: "var(--font-label)",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--on-surface)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  convTime: {
    fontFamily: "var(--font-label)",
    fontSize: 10,
    color: "var(--outline)",
    flexShrink: 0,
  },
  convPreview: {
    fontFamily: "var(--font-body)",
    fontSize: 12,
    color: "var(--outline)",
    marginTop: 3,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  unreadBadge: {
    fontFamily: "var(--font-label)",
    fontSize: 10,
    fontWeight: 700,
    color: "var(--on-primary-container)",
    background: "var(--primary-container)",
    padding: "1px 6px",
    minWidth: 18,
    textAlign: "center" as const,
    flexShrink: 0,
  },
  platformDot: (color: string) => ({
    width: 8,
    height: 8,
    background: color,
    flexShrink: 0,
    marginTop: 4,
  }),

  // Center panel
  centerPanel: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    background: "var(--bg)",
    minWidth: 0,
  },
  threadHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 20px",
    background: "var(--surface-container)",
    borderBottom: "1px solid var(--outline-variant)",
  },
  threadHeaderLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  threadName: {
    fontFamily: "var(--font-headline)",
    fontSize: 14,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.02em",
    color: "var(--on-surface)",
  },
  platformBadge: (color: string) => ({
    fontFamily: "var(--font-label)",
    fontSize: 10,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    color,
    padding: "2px 8px",
    background: color + "18",
  }),
  threadMessages: {
    flex: 1,
    overflow: "auto",
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
  },
  messageBubble: (outgoing: boolean) => ({
    maxWidth: "70%",
    alignSelf: outgoing ? "flex-end" as const : "flex-start" as const,
    padding: "10px 14px",
    background: outgoing ? "var(--surface-high)" : "var(--surface-container)",
    borderLeft: outgoing ? "3px solid var(--primary-dim)" : "3px solid var(--outline-variant)",
  }),
  messageContent: {
    fontFamily: "var(--font-body)",
    fontSize: 13,
    color: "var(--on-surface)",
    lineHeight: "1.5",
    whiteSpace: "pre-wrap" as const,
  },
  messageMeta: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  messageSender: {
    fontFamily: "var(--font-label)",
    fontSize: 10,
    color: "var(--outline)",
    letterSpacing: "0.04em",
  },
  messageTime: {
    fontFamily: "var(--font-label)",
    fontSize: 10,
    color: "var(--outline-variant)",
  },
  typingIndicator: {
    alignSelf: "flex-start" as const,
    padding: "10px 14px",
    background: "var(--surface-container)",
    borderLeft: "3px solid var(--outline-variant)",
  },
  typingDots: {
    fontFamily: "var(--font-body)",
    fontSize: 13,
    color: "var(--outline)",
    letterSpacing: 4,
  },
  overrideBar: {
    display: "flex",
    gap: 8,
    padding: "10px 20px",
    background: "var(--surface-container)",
    borderTop: "1px solid var(--outline-variant)",
    alignItems: "center",
  },
  overrideInput: {
    flex: 1,
    background: "var(--surface-lowest)",
    border: "none",
    borderBottom: "2px solid transparent",
    padding: "8px 12px",
    fontFamily: "var(--font-body)",
    fontSize: 13,
    color: "var(--on-surface)",
    outline: "none",
  },
  overrideButton: {
    background: "var(--primary-container)",
    border: "none",
    padding: "8px 16px",
    fontFamily: "var(--font-label)",
    fontSize: 11,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    color: "var(--on-primary-container)",
    cursor: "pointer",
  },
  emptyThread: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--outline)",
    fontFamily: "var(--font-body)",
    fontSize: 14,
  },

  // Right panel
  rightPanel: {
    width: 260,
    background: "var(--surface-low)",
    display: "flex",
    flexDirection: "column" as const,
    flexShrink: 0,
    overflow: "auto",
  },
  sectionTitle: {
    fontFamily: "var(--font-headline)",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    color: "var(--outline)",
    padding: "14px 14px 8px",
  },
  agentCard: {
    padding: "10px 14px",
    background: "var(--surface-container)",
    margin: "0 8px 6px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  agentHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  agentNameRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  agentName: {
    fontFamily: "var(--font-label)",
    fontSize: 12,
    fontWeight: 600,
    color: "var(--on-surface)",
  },
  statusDot: (color: string) => ({
    width: 7,
    height: 7,
    background: color,
    flexShrink: 0,
  }),
  tierBadge: (color: string) => ({
    fontFamily: "var(--font-label)",
    fontSize: 10,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    color,
    padding: "1px 6px",
    background: color + "18",
  }),
  agentMeta: {
    fontFamily: "var(--font-label)",
    fontSize: 11,
    color: "var(--outline)",
  },
  routeRow: {
    padding: "8px 14px",
    margin: "0 8px 4px",
    background: "var(--surface-container)",
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
  },
  routeDefault: {
    padding: "8px 14px",
    margin: "0 8px 4px",
    background: "var(--surface-container)",
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
    borderLeft: "3px solid var(--primary-container)",
  },
  routeCondition: {
    fontFamily: "var(--font-label)",
    fontSize: 11,
    color: "var(--on-surface)",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  routeArrow: {
    fontFamily: "var(--font-label)",
    fontSize: 11,
    color: "var(--outline)",
  },
  routeTarget: {
    fontFamily: "var(--font-label)",
    fontSize: 11,
    color: "var(--on-surface-variant)",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GatewayView() {
  const { conversations, agents, routes } = useGatewayData();

  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConvId, setSelectedConvId] = useState<string | null>(conversations[0]?.id ?? null);
  const [overrideText, setOverrideText] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Filter conversations
  const filtered = useMemo(() => {
    return conversations.filter((c) => {
      if (platformFilter !== "all" && c.platform !== platformFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          c.senderName.toLowerCase().includes(q) ||
          c.senderHandle.toLowerCase().includes(q) ||
          c.lastMessage.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [conversations, platformFilter, searchQuery]);

  const selectedConv = useMemo(
    () => conversations.find((c) => c.id === selectedConvId) ?? null,
    [conversations, selectedConvId],
  );

  // Auto-scroll to bottom on conversation change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedConvId]);

  const handleOverride = useCallback(() => {
    if (!overrideText.trim()) return;
    // In real implementation, this would send via WS
    setOverrideText("");
  }, [overrideText]);

  return (
    <div style={s.container}>
      {/* Left panel — Conversation list */}
      <div style={s.leftPanel}>
        {/* Platform filter tabs */}
        <div style={s.filterBar}>
          {(["all", "whatsapp", "email", "webhook"] as PlatformFilter[]).map((p) => (
            <button
              key={p}
              style={s.filterTab(platformFilter === p)}
              onClick={() => setPlatformFilter(p)}
            >
              {p === "all" ? "All" : PLATFORM_LABEL[p]}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={s.searchBox}>
          <input
            style={s.searchInput}
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Conversations */}
        <div style={s.conversationList}>
          {filtered.length === 0 ? (
            <div style={{ padding: 16, color: "var(--outline)", fontFamily: "var(--font-body)", fontSize: 13 }}>
              No conversations match.
            </div>
          ) : (
            filtered.map((conv) => (
              <div
                key={conv.id}
                style={s.conversationItem(selectedConvId === conv.id)}
                onClick={() => setSelectedConvId(conv.id)}
              >
                <div style={s.platformDot(PLATFORM_COLOR[conv.platform])} />
                <div style={s.convContent}>
                  <div style={s.convHeader}>
                    <span style={s.convName}>{conv.senderName}</span>
                    <span style={s.convTime}>{timeAgo(conv.lastMessageTime)}</span>
                  </div>
                  <div style={s.convPreview}>{conv.lastMessage}</div>
                </div>
                {conv.unread > 0 && (
                  <div style={s.unreadBadge}>{conv.unread}</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Center panel — Conversation thread */}
      <div style={s.centerPanel}>
        {selectedConv ? (
          <>
            {/* Thread header */}
            <div style={s.threadHeader}>
              <div style={s.threadHeaderLeft}>
                <span style={s.threadName}>{selectedConv.senderName}</span>
                <span style={s.platformBadge(PLATFORM_COLOR[selectedConv.platform])}>
                  {PLATFORM_LABEL[selectedConv.platform]}
                </span>
                {selectedConv.status === "resolved" && (
                  <span style={{ ...s.platformBadge("#4ADE80"), marginLeft: 4 }}>Resolved</span>
                )}
              </div>
              <span style={{ fontFamily: "var(--font-label)", fontSize: 11, color: "var(--outline)" }}>
                {selectedConv.senderHandle}
              </span>
            </div>

            {/* Messages */}
            <div style={s.threadMessages}>
              {selectedConv.messages.map((msg) => (
                <div key={msg.id} style={s.messageBubble(msg.direction === "outgoing")}>
                  <div style={s.messageContent}>{msg.content}</div>
                  <div style={s.messageMeta}>
                    <span style={s.messageSender}>{msg.sender}</span>
                    <span style={s.messageTime}>{formatTime(msg.timestamp)}</span>
                    <span style={s.platformBadge(PLATFORM_COLOR[msg.platform])}>
                      {PLATFORM_LABEL[msg.platform]}
                    </span>
                  </div>
                </div>
              ))}

              {/* Typing indicator for active conversations */}
              {selectedConv.status === "active" && (
                <div style={s.typingIndicator}>
                  <div style={s.typingDots}>...</div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Override bar */}
            <div style={s.overrideBar}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--outline)" }}>
                edit
              </span>
              <input
                style={s.overrideInput}
                placeholder="Override — jump into this conversation..."
                value={overrideText}
                onChange={(e) => setOverrideText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleOverride()}
                onFocus={(e) => { e.currentTarget.style.borderBottomColor = "var(--primary-container)"; }}
                onBlur={(e) => { e.currentTarget.style.borderBottomColor = "transparent"; }}
              />
              <button style={s.overrideButton} onClick={handleOverride}>Send</button>
            </div>
          </>
        ) : (
          <div style={s.emptyThread}>
            Select a conversation to view the thread.
          </div>
        )}
      </div>

      {/* Right panel — Agent status + Routing */}
      <div style={s.rightPanel}>
        {/* Agent status */}
        <div style={s.sectionTitle}>Agent Status</div>
        {agents.map((agent) => (
          <div key={agent.name} style={s.agentCard}>
            <div style={s.agentHeader}>
              <div style={s.agentNameRow}>
                <div style={s.statusDot(AGENT_STATUS_COLOR[agent.status])} />
                <span style={s.agentName}>{agent.name}</span>
              </div>
              <span style={s.tierBadge(MODEL_TIER_COLOR[agent.modelTier])}>
                {agent.modelTier}
              </span>
            </div>
            <div style={s.agentMeta}>
              {agent.activeConversations} active conversation{agent.activeConversations !== 1 ? "s" : ""}
              {" "}&middot;{" "}
              <span style={{ color: AGENT_STATUS_COLOR[agent.status] }}>
                {agent.status.toUpperCase()}
              </span>
            </div>
          </div>
        ))}

        {/* Routing config */}
        <div style={{ ...s.sectionTitle, marginTop: 8 }}>Routing Config</div>
        {routes.map((route) => (
          <div key={route.id} style={route.isDefault ? s.routeDefault : s.routeRow}>
            <div style={s.routeCondition}>
              <span style={s.platformBadge(PLATFORM_COLOR[route.platform])}>
                {PLATFORM_LABEL[route.platform]}
              </span>
              <span style={{ color: "var(--on-surface-variant)", fontFamily: "var(--font-label)", fontSize: 11 }}>
                {route.channelPattern}
              </span>
            </div>
            <div style={s.routeTarget}>
              <span style={s.routeArrow}>&rarr;</span>
              <span>{route.assignedAgent}</span>
              <span style={s.tierBadge(MODEL_TIER_COLOR[route.modelTier])}>
                {route.modelTier}
              </span>
              {route.isDefault && (
                <span style={{ color: "var(--primary-container)", fontFamily: "var(--font-label)", fontSize: 10 }}>
                  DEFAULT
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
