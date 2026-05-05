import { useCallback, useMemo, useState } from "react";
import { Sidebar, type TabKey } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { OfficeView } from "./views/Office";
import { WorkView } from "./views/Work";
import { WikiView } from "./views/Wiki";
import CRM from "./views/CRM";
import { TeamView } from "./views/Team";
import { SettingsView } from "./views/Settings";

interface WorkChatRequest {
  employeeName?: string;
  nonce: number;
}

export function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("office");
  const [workChatRequest, setWorkChatRequest] = useState<WorkChatRequest | null>(null);

  const handleFocusAgent = useCallback((agent: { name?: string }) => {
    setWorkChatRequest({
      employeeName: agent.name,
      nonce: Date.now(),
    });
    setActiveTab("work");
  }, []);

  const view = useMemo(() => {
    switch (activeTab) {
      case "office":
        return <OfficeView onFocusAgent={handleFocusAgent} />;
      case "work":
        return <WorkView chatRequest={workChatRequest} />;
      case "wiki":
        return <WikiView />;
      case "crm":
        return <CRM />;
      case "team":
        return <TeamView />;
      case "settings":
        return <SettingsView />;
      default:
        return null;
    }
  }, [activeTab, handleFocusAgent, workChatRequest]);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          marginLeft: 200,
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
    </div>
  );
}
