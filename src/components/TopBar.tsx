/**
 * TopBar — page title, daemon status, functional search, and notification bell.
 *
 * Search: queries exe-os recall_memory via Tauri IPC on Enter.
 * Bell: polls pending tasks (open + needs_review) and shows badge + dropdown.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import type { TabKey } from "./Sidebar";
import { daemonStatus, recallMemory, listTasks } from "../services/tauriApi.js";

const TAB_TITLES: Record<TabKey, string> = {
  office: "Virtual Office",
  work: "Work Dashboard",
  wiki: "Knowledge Base",
  crm: "Exe CRM",
  team: "Team Roster",
  settings: "Settings",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchResult {
  id: string;
  text: string;
  score: number;
}

interface PendingTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignedTo: string;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const dropdownBase: React.CSSProperties = {
  position: "absolute",
  top: "100%",
  right: 0,
  marginTop: 4,
  background: "var(--surface-low)",
  border: "1px solid var(--outline-variant)",
  maxHeight: 360,
  overflow: "auto",
  zIndex: 100,
  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
};

const dropdownItem: React.CSSProperties = {
  padding: "10px 16px",
  borderBottom: "1px solid var(--surface-container)",
  cursor: "default",
};

const dropdownText: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 12,
  color: "var(--on-surface)",
  lineHeight: "1.4",
  display: "-webkit-box",
  WebkitLineClamp: 3,
  WebkitBoxOrient: "vertical" as const,
  overflow: "hidden",
};

const dropdownMeta: React.CSSProperties = {
  fontFamily: "var(--font-label)",
  fontSize: 10,
  color: "var(--outline)",
  marginTop: 4,
};

const PRIORITY_COLOR: Record<string, string> = {
  p0: "#EF4444",
  p1: "#F5D76E",
  p2: "var(--outline)",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TopBar({ activeTab }: { activeTab: TabKey }) {
  // --- Daemon status ---
  const [live, setLive] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    async function check() {
      try {
        const s = await daemonStatus();
        if (mounted) setLive(s.running);
      } catch {
        if (mounted) setLive(false);
      }
    }
    void check();
    const id = setInterval(() => void check(), 10_000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  const liveColor = live === null
    ? "var(--outline)"
    : live
      ? "#4caf50"
      : "var(--tertiary-dim)";
  const liveLabel = live === null ? "CHECKING..." : live ? "LIVE" : "OFFLINE";

  // --- Search state ---
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // --- Notification state ---
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  // --- Search handler ---
  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;

    setSearching(true);
    setSearchOpen(true);
    try {
      const results = await recallMemory(q, 10);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  // --- Poll pending tasks ---
  useEffect(() => {
    let cancelled = false;

    async function fetchPending() {
      try {
        const all = await listTasks();
        const pending = all
          .filter((t) => t.status === "open" || t.status === "needs_review")
          .map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            assignedTo: t.assigned_to,
          }));
        if (!cancelled) setPendingTasks(pending);
      } catch {
        // Tauri not available — no notifications in demo mode
      }
    }

    void fetchPending();
    const interval = setInterval(() => void fetchPending(), 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // --- Click outside to close dropdowns ---
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const badgeCount = pendingTasks.length;

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        left: 200,
        height: 64,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0 32px",
        background: "var(--surface-low)",
        fontFamily: "var(--font-headline)",
        fontWeight: 700,
        textTransform: "uppercase",
        fontSize: 14,
        letterSpacing: "0.1em",
        zIndex: 30,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: "var(--on-surface)" }}>
          {TAB_TITLES[activeTab]}
        </span>
        <div style={{ height: 16, width: 1, background: "var(--outline-variant)" }} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 10,
            color: "var(--primary-dim)",
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: liveColor,
              boxShadow: live ? "0 0 8px rgba(76,175,80,0.6)" : "none",
            }}
          />
          <span>{liveLabel}</span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        {/* Search */}
        <div ref={searchRef} style={{ position: "relative" }}>
          <input
            type="text"
            placeholder="SEARCH..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSearch();
              if (e.key === "Escape") setSearchOpen(false);
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = "0 0 0 1px var(--primary-container)";
              if (searchResults.length > 0) setSearchOpen(true);
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = "none";
            }}
            style={{
              background: "var(--surface-lowest)",
              border: "none",
              fontSize: 10,
              padding: "8px 16px",
              width: 192,
              color: "var(--on-surface)",
              fontFamily: "var(--font-label)",
              textTransform: "uppercase",
              outline: "none",
            }}
          />

          {searchOpen && (
            <div style={{ ...dropdownBase, width: 360 }}>
              {searching ? (
                <div style={{ ...dropdownItem, color: "var(--outline)", fontFamily: "var(--font-body)", fontSize: 12 }}>
                  Searching...
                </div>
              ) : searchResults.length === 0 ? (
                <div style={{ ...dropdownItem, color: "var(--outline)", fontFamily: "var(--font-body)", fontSize: 12 }}>
                  No results found.
                </div>
              ) : (
                searchResults.map((r) => (
                  <div key={r.id} style={dropdownItem}>
                    <div style={dropdownText}>{r.text}</div>
                    <div style={dropdownMeta}>
                      score: {(r.score * 100).toFixed(0)}%
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Notification bell */}
        <div ref={bellRef} style={{ position: "relative" }}>
          <button
            onClick={() => setBellOpen(!bellOpen)}
            style={{
              background: "none",
              border: "none",
              color: "var(--outline)",
              cursor: "pointer",
              position: "relative",
              padding: 4,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {badgeCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  background: "#EF4444",
                  color: "#fff",
                  fontSize: 9,
                  fontFamily: "var(--font-label)",
                  fontWeight: 700,
                  minWidth: 14,
                  height: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 3px",
                }}
              >
                {badgeCount > 99 ? "99+" : badgeCount}
              </span>
            )}
          </button>

          {bellOpen && (
            <div style={{ ...dropdownBase, width: 320 }}>
              {pendingTasks.length === 0 ? (
                <div style={{ ...dropdownItem, color: "var(--outline)", fontFamily: "var(--font-body)", fontSize: 12 }}>
                  No pending items.
                </div>
              ) : (
                pendingTasks.slice(0, 20).map((t) => (
                  <div key={t.id} style={dropdownItem}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          fontFamily: "var(--font-label)",
                          fontSize: 10,
                          fontWeight: 700,
                          color: PRIORITY_COLOR[t.priority] ?? "var(--outline)",
                          textTransform: "uppercase",
                          flexShrink: 0,
                        }}
                      >
                        {t.priority}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-label)",
                          fontSize: 10,
                          color: t.status === "needs_review" ? "#F5D76E" : "var(--outline)",
                          textTransform: "uppercase",
                          flexShrink: 0,
                        }}
                      >
                        {t.status.replace("_", " ")}
                      </span>
                    </div>
                    <div style={{ ...dropdownText, marginTop: 4, WebkitLineClamp: 2 }}>{t.title}</div>
                    <div style={dropdownMeta}>{t.assignedTo}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
