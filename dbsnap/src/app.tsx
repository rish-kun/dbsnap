import React, { useState, useEffect } from "react";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { Tabs } from "./components/Tabs";
import { DashboardView } from "./views/Dashboard";
import { BackupView } from "./views/BackupView";
import { RestoreView } from "./views/RestoreView";
import { ConfigView } from "./views/ConfigView";
import { loadConfig } from "./services/config";

export function App() {
  const [activeTab, setActiveTab] = useState(0);
  const tabs = ["Dashboard", "Backup", "Restore", "Config"];
  const [config, setConfig] = useState<Record<string, string>>({});
  const [configLoaded, setConfigLoaded] = useState(false);
  const { width, height } = useTerminalDimensions();

  useEffect(() => {
    loadConfig().then(c => {
      setConfig(c);
      setConfigLoaded(true);
    });
  }, []);

  useKeyboard((key) => {
    if (key.ctrl && key.name === "q") {
      process.exit(0);
    }
    
    if (key.name === "1") setActiveTab(0);
    if (key.name === "2") setActiveTab(1);
    if (key.name === "3") setActiveTab(2);
    if (key.name === "4") setActiveTab(3);
  });

  if (!configLoaded) {
    return (
      <box style={{ width: "100%", height: "100%", justifyContent: "center", alignItems: "center" }}>
        <text fg="#FFA500">Loading Configuration...</text>
      </box>
    );
  }

  return (
    <box style={{ flexDirection: "column", width: "100%", height: "100%" }}>
      <box style={{ flexDirection: "row", paddingX: 1, backgroundColor: "#1a1a1a", height: 3, alignItems: "center" }}>
        <text fg="#00FF00" bold>📸 DBSnap CLI</text>
        <text fg="#666">  │  </text>
        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      </box>
      
      <box style={{ flexGrow: 1, padding: 1, overflow: "hidden" }}>
        {activeTab === 0 && <DashboardView config={config} />}
        {activeTab === 1 && <BackupView config={config} isFocused={true} />}
        {activeTab === 2 && <RestoreView config={config} isFocused={true} />}
        {activeTab === 3 && <ConfigView config={config} isFocused={true} onConfigUpdate={setConfig} />}
      </box>
      
      <box style={{ height: 2, paddingX: 1, borderTop: true, borderColor: "#333", alignItems: "center" }}>
        <text fg="#666">[1-4] Tabs</text>
        <text fg="#444">  </text>
        <text fg="#666">[Ctrl+Q] Quit</text>
        <text fg="#444">  </text>
        <text fg="#444">│</text>
        <text fg="#666">  {width}x{height}</text>
      </box>
    </box>
  );
}
