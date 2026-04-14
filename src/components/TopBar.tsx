import React from "react";
import type { TabKey } from "./Sidebar";

const TAB_TITLES: Record<TabKey, string> = {
  office: "Virtual Office",
  work: "Work Dashboard",
  wiki: "Company Wiki",
  crm: "Exe CRM",
  team: "Team Roster",
  settings: "Settings",
};

export function TopBar({ activeTab }: { activeTab: TabKey }) {
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
              background: "var(--tertiary-dim)",
              boxShadow: "0 0 8px rgba(255,180,168,0.6)",
            }}
          />
          <span id="live-status">LIVE: LOADING...</span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <input
          type="text"
          placeholder="SEARCH..."
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
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = "0 0 0 1px var(--primary-container)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = "none";
          }}
        />
        <button
          style={{
            background: "none",
            border: "none",
            color: "var(--outline)",
            cursor: "pointer",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            notifications
          </span>
        </button>
      </div>
    </header>
  );
}
