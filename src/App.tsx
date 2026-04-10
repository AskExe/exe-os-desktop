import React, { useState } from "react";
import { Sidebar, type TabKey } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { OfficeView } from "./views/Office";
import { WorkView } from "./views/Work";
import { TeamView } from "./views/Team";
import { ExternalView } from "./views/External";
import { WikiView } from "./views/Wiki";
import { SettingsView } from "./views/Settings";

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
  const View = views[activeTab];

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", marginLeft: 200 }}>
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
    </div>
  );
}
