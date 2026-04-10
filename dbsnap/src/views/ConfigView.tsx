import React, { useState, useEffect } from "react";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { saveConfig } from "../services/config";
import { getDatabases } from "../services/docker";
import { LogViewer } from "../components/LogViewer";
import { CronPanel } from "./CronPanel";

export type ConfigViewProps = { 
  config: Record<string, string>, 
  isFocused: boolean, 
  onConfigUpdate: (c: Record<string, string>) => void 
};

export function ConfigView({ config, isFocused, onConfigUpdate }: ConfigViewProps) {
  const [formData, setFormData] = useState<Record<string, string>>(config);
  const [focusedField, setFocusedField] = useState<string>("API_URL");
  const [logs, setLogs] = useState<string[]>([]);
  const [activeSection, setActiveSection] = useState<"config" | "cron">("config");
  const { height } = useTerminalDimensions();
  
  const fields = [
    { key: "API_URL", label: "Appwrite URL" },
    { key: "PROJECT_ID", label: "Project ID" },
    { key: "BUCKET_ID", label: "Bucket ID" },
    { key: "API_BACKUP_KEY", label: "API Key", secret: true },
    { key: "SENDGRID_API_KEY", label: "SendGrid Key", secret: true },
    { key: "EMAIL_FROM", label: "Email From" },
    { key: "EMAIL_TO", label: "Email To" },
    { key: "DOCKER_CONTAINER", label: "Container" },
    { key: "DB_NAME", label: "Database" },
    { key: "SCRIPT_PASSWORD", label: "Sudo Password", secret: true },
  ];

  const [dbSelectorMode, setDbSelectorMode] = useState(false);
  const [availableDbs, setAvailableDbs] = useState<string[]>([]);
  const [dbSelectorIndex, setDbSelectorIndex] = useState(0);

  useEffect(() => {
    setAvailableDbs([]);
    setDbSelectorMode(false);
  }, [formData.DOCKER_CONTAINER]);

  useEffect(() => {
    if (activeSection === "cron") {
      setDbSelectorMode(false);
      setAvailableDbs([]);
    }
  }, [activeSection]);

  const handleInput = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

  const fetchDatabases = async () => {
    const container = formData.DOCKER_CONTAINER;
    if (!container) {
      addLog("❌ Please set DOCKER_CONTAINER first");
      return;
    }
    addLog(`Fetching databases from ${container}...`);
    const dbUser = formData.DB_USER || "postgres";
    const dbs = await getDatabases(container, dbUser);
    if (dbs.length > 0) {
      setAvailableDbs(dbs);
      setDbSelectorIndex(0);
      addLog(`✅ Found ${dbs.length} database(s)`);
    } else {
      addLog("❌ No databases found or container not accessible");
    }
  };

  const handleSave = async () => {
    try {
      addLog("Saving configuration to .env...");
      const updated = await saveConfig(formData);
      onConfigUpdate(updated);
      addLog("✅ Configuration saved successfully.");
    } catch (e: any) {
      addLog(`❌ Failed to save config: ${e.message}`);
    }
  };

  useKeyboard((key) => {
    if (!isFocused) return;
    
    if (key.ctrl && key.name === "j") {
      setDbSelectorMode(false);
      setAvailableDbs([]);
      setActiveSection(activeSection === "config" ? "cron" : "config");
      return;
    }
    
    if (activeSection === "config") {
      if (dbSelectorMode) {
        if (key.name === "down" || key.name === "tab") {
          setDbSelectorIndex(prev => (prev + 1) % availableDbs.length);
        } else if (key.name === "up") {
          setDbSelectorIndex(prev => (prev - 1 + availableDbs.length) % availableDbs.length);
        } else if (key.name === "enter") {
          const selectedDb = availableDbs[dbSelectorIndex];
          if (selectedDb) {
            handleInput("DB_NAME", selectedDb);
          }
          setDbSelectorMode(false);
        } else if (key.name === "escape") {
          setDbSelectorMode(false);
        }
        return;
      }
      
      const currentIndex = fields.findIndex(f => f.key === focusedField);
      
      if (key.name === "down" || key.name === "tab") {
        const nextIndex = (currentIndex + 1) % fields.length;
        const nextField = fields[nextIndex];
        if (nextField) setFocusedField(nextField.key);
      } else if (key.name === "up") {
        const prevIndex = (currentIndex - 1 + fields.length) % fields.length;
        const prevField = fields[prevIndex];
        if (prevField) setFocusedField(prevField.key);
      } else if (key.ctrl && key.name === "s") {
        handleSave();
      } else if (focusedField === "DB_NAME") {
        if (key.name === "r" && !key.ctrl) {
          fetchDatabases();
        } else if (key.name === "space" || key.name === "enter") {
          if (availableDbs.length > 0) {
            const idx = availableDbs.findIndex(db => db === formData.DB_NAME);
            setDbSelectorIndex(idx >= 0 ? idx : 0);
            setDbSelectorMode(true);
          } else {
            fetchDatabases();
          }
        }
      }
    }
  });

  if (activeSection === "cron") {
    return (
      <box style={{ flexDirection: "column", gap: 1, height: "100%", overflow: "hidden" }}>
        <text fg="#FFA500" bold>⚙️ Cron Jobs Configuration</text>
        
        <box style={{ flexDirection: "row" }}>
          <text fg="#666">[Tab/↑/↓] Navigate</text>
          <text fg="#444">  </text>
          <text fg="#666">[Ctrl+J] Back to Config</text>
        </box>

        <CronPanel config={formData} isFocused={isFocused && activeSection === "cron"} logs={logs} setLogs={setLogs} />
      </box>
    );
  }

  return (
    <box style={{ flexDirection: "column", gap: 1, height: "100%", overflow: "hidden" }}>
      <text fg="#FFA500" bold>⚙️ Configuration</text>
      
      <box style={{ flexDirection: "row" }}>
        <text fg="#666">[Tab/↑/↓] Navigate</text>
        <text fg="#444">  </text>
        <text fg="#666">[Ctrl+S] Save</text>
        <text fg="#444">  </text>
        <text fg="#666">[Ctrl+J] Cron Jobs</text>
      </box>

      <box style={{ 
        flexDirection: "column", 
        border: true, 
        padding: 1, 
        borderColor: "#333",
        flexGrow: 1,
        maxHeight: Math.floor(height / 2)
      }}>
        {fields.map(({ key, label, secret }) => (
          <box key={key} style={{ flexDirection: "column", marginBottom: 0 }}>
            <box style={{ flexDirection: "row" }}>
              <text 
                fg={isFocused && focusedField === key ? "#0F0" : "#666"} 
                style={{ width: 16 }}
              >
                {label}:
              </text>
              <input
                id={key}
                placeholder={secret ? "••••••••" : `Enter ${label.toLowerCase()}...`}
                onInput={(val: string) => handleInput(key, val)}
                focused={isFocused && focusedField === key && !(key === "DB_NAME" && dbSelectorMode)}
                value={formData[key] || ""}
              />
              {key === "DB_NAME" && (
                <text fg="#444"> [R] Refresh [Space] Select</text>
              )}
            </box>
            {key === "DB_NAME" && dbSelectorMode && availableDbs.length > 0 && (
              <box style={{ flexDirection: "column", marginLeft: 18, padding: 1, border: true, borderColor: "#0F0" }}>
                {availableDbs.map((db, idx) => (
                  <text key={db} fg={idx === dbSelectorIndex ? "#0F0" : "#666"}>
                    {idx === dbSelectorIndex ? "▶ " : "  "}{db}
                  </text>
                ))}
                <text fg="#444" style={{ marginTop: 1 }}>[↑/↓] Select [Enter] Confirm [Esc] Cancel</text>
              </box>
            )}
          </box>
        ))}
      </box>
      
      <LogViewer logs={logs} title="Config Logs" />
    </box>
  );
}
