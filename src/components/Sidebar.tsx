import React from "react";

export type TabKey = "office" | "work" | "team" | "gateway" | "external" | "wiki" | "settings";

interface TabDef {
  key: TabKey;
  label: string;
  icon: string;
}

const TABS: TabDef[] = [
  { key: "office", label: "Office", icon: "desktop_windows" },
  { key: "work", label: "Work", icon: "work" },
  { key: "team", label: "Team", icon: "group" },
  { key: "gateway", label: "Gateway", icon: "router" },
  { key: "external", label: "External", icon: "open_in_new" },
  { key: "wiki", label: "Wiki", icon: "menu_book" },
  { key: "settings", label: "Settings", icon: "settings" },
];

export function Sidebar({
  activeTab,
  onTabChange,
}: {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}) {
  return (
    <aside
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        height: "100%",
        width: 200,
        background: "var(--surface-lowest)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--font-headline)",
        textTransform: "uppercase",
        letterSpacing: "-0.02em",
        zIndex: 40,
      }}
    >
      {/* Logo */}
      <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 4 }}>
        <div
          style={{
            fontSize: 24,
            fontWeight: 900,
            color: "var(--primary-container)",
            letterSpacing: "-0.02em",
          }}
        >
          EXE OFFICE
        </div>
        <div
          style={{
            fontSize: 10,
            color: "var(--outline)",
            letterSpacing: "0.1em",
            opacity: 0.7,
          }}
        >
          ANALOG TERMINAL v1.0
        </div>
      </div>

      {/* Tabs */}
      <nav style={{ flex: 1, marginTop: 16 }}>
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <a
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 20px",
                cursor: "pointer",
                color: isActive ? "var(--primary-container)" : "var(--outline)",
                background: isActive ? "var(--surface-high)" : "transparent",
                borderLeft: isActive ? "4px solid var(--primary-container)" : "4px solid transparent",
                fontWeight: isActive ? 700 : 400,
                fontSize: 12,
                transition: "all 0.2s",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = "var(--primary-container)";
                  e.currentTarget.style.background = "var(--surface-high)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = "var(--outline)";
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </a>
          );
        })}
      </nav>

      {/* User avatar placeholder */}
      <div style={{ padding: 24 }}>
        <div
          style={{
            width: 40,
            height: 40,
            background: "var(--surface-high)",
            border: "2px solid rgba(152, 144, 125, 0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <span className="material-symbols-outlined" style={{ color: "var(--outline)" }}>
            person
          </span>
        </div>
      </div>
    </aside>
  );
}
