import React, { useCallback, useEffect, useState } from "react";
import { ChatView } from "./components/ChatView";
import { Sidebar, type TabKey } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { OfficeView } from "./views/Office";
import { WorkView } from "./views/Work";
import { TeamView } from "./views/Team";
import { ExternalView } from "./views/External";
import { WikiView } from "./views/Wiki";
import { SettingsView } from "./views/Settings";

const CHAT_PANEL_WIDTH = 420;

const views: Record<TabKey, React.FC> = {
  office: OfficeView,
  work: WorkView,
  team: TeamView,
  external: ExternalView,
  wiki: WikiView,
  settings: SettingsView,
};

export function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("office");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatTarget, setChatTarget] = useState<string | undefined>(undefined);
  const View = views[activeTab];

  const openChat = useCallback((employeeName?: string) => {
    setChatTarget(employeeName);
    setChatOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setChatOpen(false);
  }, []);

  // 'c' key toggles chat panel
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "c" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        setChatOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          marginLeft: 200,
          marginRight: chatOpen ? CHAT_PANEL_WIDTH : 0,
          transition: "margin-right 0.2s ease",
        }}
      >
        <TopBar activeTab={activeTab} />
        <main
          style={{
            flex: 1,
            padding: 32,
            marginTop: 64,
            overflow: "auto",
            background: "var(--bg)",
          }}
        >
          <View />
        </main>
      </div>

      {/* Chat slide-over panel */}
      <div
        style={{
          position: "fixed",
          right: chatOpen ? 0 : -CHAT_PANEL_WIDTH,
          top: 0,
          width: CHAT_PANEL_WIDTH,
          height: "100vh",
          transition: "right 0.2s ease",
          zIndex: 50,
          borderLeft: "1px solid var(--outline-variant)",
        }}
      >
        {chatOpen && <ChatView employeeName={chatTarget} onClose={closeChat} />}
      </div>
    </div>
  );
}
