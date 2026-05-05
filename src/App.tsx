import React, { useCallback, useEffect, useState } from "react";
import { ChatView } from "./components/ChatView";
import { Sidebar, type TabKey } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { OfficeView } from "./views/Office";
import { WorkView, type WorkMode } from "./views/Work";
import { WikiView } from "./views/Wiki";
import CRM from "./views/CRM";
import { TeamView } from "./views/Team";
import { SettingsView } from "./views/Settings";

const CHAT_PANEL_WIDTH = 420;

interface WorkRequest {
  employeeName?: string;
  mode?: WorkMode;
  token: number;
}

export function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("office");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatTarget, setChatTarget] = useState<string | undefined>(undefined);
  const [workRequest, setWorkRequest] = useState<WorkRequest>({ token: 0 });

  const handleTabChange = useCallback((tab: TabKey) => {
    setActiveTab(tab);
  }, []);

  const closeChat = useCallback(() => {
    setChatOpen(false);
  }, []);

  const handleOpenAgentChat = useCallback((employeeName: string) => {
    setActiveTab("work");
    setChatTarget(employeeName);
    setChatOpen(false);
    setWorkRequest({
      employeeName,
      mode: "chat",
      token: Date.now(),
    });
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

  let view: React.ReactNode;
  switch (activeTab) {
    case "office":
      view = (
        <OfficeView
          activeTab={activeTab}
          onNavigate={handleTabChange}
          onOpenAgentChat={handleOpenAgentChat}
        />
      );
      break;
    case "work":
      view = (
        <WorkView
          focusedEmployeeName={workRequest.employeeName}
          requestToken={workRequest.token}
          requestedMode={workRequest.mode}
        />
      );
      break;
    case "wiki":
      view = <WikiView />;
      break;
    case "crm":
      view = <CRM />;
      break;
    case "team":
      view = <TeamView />;
      break;
    case "settings":
      view = <SettingsView />;
      break;
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
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
          {view}
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
