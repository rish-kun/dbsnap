import React, { useState } from "react";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { saveConfig } from "../services/config";
import { setupCronJob } from "../services/cron";
import { LogViewer } from "../components/LogViewer";

export function ConfigView({ config, isFocused, onConfigUpdate }: { 
  config: Record<string, string>, 
  isFocused: boolean, 
  onConfigUpdate: (c: Record<string, string>) => void 
}) {
  const [formData, setFormData] = useState<Record<string, string>>(config);
  const [focusedField, setFocusedField] = useState<string>("API_URL");
  const [logs, setLogs] = useState<string[]>([]);
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
    { key: "SCRIPT_PASSWORD", label: "Sudo Password", secret: true },
  ];

  const handleInput = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

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

  const handleCron = async () => {
    addLog("Setting up daily cron job (midnight)...");
    await setupCronJob("0 0 * * *", addLog);
  };

  useKeyboard((key) => {
    if (!isFocused) return;
    
    const currentIndex = fields.findIndex(f => f.key === focusedField);
    
    if (key.name === "down" || key.name === "tab") {
      const nextIndex = (currentIndex + 1) % fields.length;
      setFocusedField(fields[nextIndex].key);
    } else if (key.name === "up") {
      const prevIndex = (currentIndex - 1 + fields.length) % fields.length;
      setFocusedField(fields[prevIndex].key);
    } else if (key.ctrl && key.name === "s") {
      handleSave();
    } else if (key.ctrl && key.name === "c") {
      handleCron();
    }
  });

  return (
    <box style={{ flexDirection: "column", gap: 1, height: "100%", overflow: "hidden" }}>
      <text fg="#FFA500" bold>⚙️ Configuration</text>
      
      <box style={{ flexDirection: "row" }}>
        <text fg="#666">[Tab/↑/↓] Navigate</text>
        <text fg="#444">  </text>
        <text fg="#666">[Ctrl+S] Save</text>
        <text fg="#444">  </text>
        <text fg="#666">[Ctrl+C] Setup Cron</text>
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
          <box key={key} style={{ flexDirection: "row", marginBottom: 0 }}>
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
              focused={isFocused && focusedField === key}
              value={formData[key] || ""}
            />
          </box>
        ))}
      </box>
      
      <LogViewer logs={logs} title="Config Logs" />
    </box>
  );
}
