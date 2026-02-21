import React, { useState } from "react";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { takeBackup } from "../services/backup";
import { uploadBackup } from "../services/storage";
import { sendEmail } from "../services/email";
import { LogViewer } from "../components/LogViewer";

export function BackupView({ config, isFocused }: { config: Record<string, string>, isFocused: boolean }) {
  const [logs, setLogs] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const { height } = useTerminalDimensions();

  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

  const runBackup = async () => {
    if (running) return;
    setRunning(true);
    setLogs([]);
    try {
      addLog("Initializing backup...");
      const localPath = await takeBackup(config, "postgres", addLog);
      const fileName = localPath.split("/").pop() ?? "backup.dump";
      
      addLog(`Preparing upload for ${fileName}...`);
      const response = await uploadBackup(config, localPath, fileName, addLog);
      
      const fileUrl = `${config.API_URL}/storage/buckets/${response.bucketId}/files/${response.$id}/view`;
      
      addLog("Sending notification email...");
      await sendEmail(config, "Database Snapshot and upload Successful", fileUrl, addLog);
      
      addLog(`✅ Complete! Response ID: ${response.$id}`);
    } catch (err: any) {
      addLog(`❌ Backup Error: ${err.message || String(err)}`);
      await sendEmail(config, err.message || String(err), "", addLog);
    } finally {
      setRunning(false);
    }
  };

  useKeyboard((key) => {
    if (isFocused && !running && key.name === "return") {
      runBackup();
    }
  });

  const logHeight = Math.max(8, Math.floor(height / 3));

  return (
    <box style={{ flexDirection: "column", gap: 1, height: "100%", overflow: "hidden" }}>
      <text fg="#00FF00" bold>🚀 Backup Runner</text>
      
      <box style={{ 
        border: true, 
        padding: 1, 
        borderColor: running ? "#FFA500" : "#444",
        backgroundColor: running ? "#1a1500" : "#0a0a0a"
      }}>
        <text fg={running ? "#FFA500" : "#0F0"}>
          {running ? "⏳ Backup in progress... Please wait." : "Press [Enter] to Start Backup"}
        </text>
      </box>
      
      {!running && (
        <box style={{ flexDirection: "row" }}>
          <text fg="#888">Status: </text>
          <text fg="#0F0">Ready</text>
        </box>
      )}
      
      {running && (
        <box style={{ flexDirection: "row" }}>
          <text fg="#888">Status: </text>
          <text fg="#FFA500">Running...</text>
        </box>
      )}
      
      <LogViewer logs={logs} title="Backup Logs" maxHeight={logHeight} />
    </box>
  );
}
