import React, { useState, useEffect } from "react";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { getFilesList, downloadBackup, type DownloadProgress } from "../services/storage";
import { restoreSelected } from "../services/restore";
import { LogViewer } from "../components/LogViewer";
import { ProgressBar } from "../components/ProgressBar";

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, idx);
  return `${value.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
}

function formatSpeed(bytesPerSecond?: number): string {
  if (!bytesPerSecond || !Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return "--";
  return `${formatBytes(bytesPerSecond)}/s`;
}

function formatEta(etaSeconds?: number): string {
  if (etaSeconds === undefined || !Number.isFinite(etaSeconds)) return "--";
  const totalSeconds = Math.max(0, Math.round(etaSeconds));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function RestoreView({ config, isFocused }: { config: Record<string, string>, isFocused: boolean }) {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadMetrics, setDownloadMetrics] = useState<DownloadProgress>({ percent: 0, downloadedBytes: 0 });
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "download" | "restore">("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const { height, width } = useTerminalDimensions();

  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

  useEffect(() => {
    if (isFocused && files.length === 0) {
      loadFiles();
    }
  }, [isFocused]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const fetched = await getFilesList(config, addLog);
      const sorted = fetched.sort((a, b) => new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime());
      setFiles(sorted);
    } catch (err: any) {
      addLog(`Failed to load files: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (files.length === 0 || running) return;
    const file = files[selectedIndex];
    setRunning(true);
    setPhase("download");
    setDownloadProgress(0);
    setDownloadMetrics({ percent: 0, downloadedBytes: 0 });
    setRestoreProgress(0);
    setLogs([]);
    try {
      addLog(`Downloading backup: ${file.name}...`);
      const localPath = "./backup.dump";
      await downloadBackup(config, file.$id, localPath, addLog, (progress) => {
        setDownloadMetrics(progress);
        setDownloadProgress(progress.percent);
      });
      
      addLog(`Starting restore process...`);
      setPhase("restore");
      setRestoreProgress(0);
      await restoreSelected(config, localPath, addLog, {
        onStageProgress: (progress) => {
          setRestoreProgress(progress);
        },
      });
      
      addLog(`✅ Complete! Database restored.`);
    } catch (err: any) {
      addLog(`❌ Restore Error: ${err.message || String(err)}`);
    } finally {
      setPhase("idle");
      setRunning(false);
    }
  };

  useKeyboard((key) => {
    if (!isFocused || running || files.length === 0) return;
    if (key.name === "up") {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    } else if (key.name === "down") {
      setSelectedIndex(prev => Math.min(files.length - 1, prev + 1));
    } else if (key.name === "return") {
      handleRestore();
    } else if (key.name === "r") {
      loadFiles();
    }
  });

  const listHeight = Math.max(5, Math.floor(height / 4));
  const visibleFiles = files.slice(
    Math.max(0, selectedIndex - Math.floor(listHeight / 2)),
    Math.min(files.length, selectedIndex + Math.ceil(listHeight / 2))
  );
  const startIndex = Math.max(0, selectedIndex - Math.floor(listHeight / 2));

  return (
    <box style={{ flexDirection: "column", gap: 1, height: "100%", overflow: "hidden" }}>
      <text fg="#00A5FF" bold>🔄 Database Restore</text>
      
      {loading ? (
        <text fg="#FFA500">Loading backups from Appwrite...</text>
      ) : files.length === 0 ? (
        <box style={{ flexDirection: "column", gap: 1 }}>
          <text fg="#F55">No backups found.</text>
          <text fg="#888">Press [R] to refresh</text>
        </box>
      ) : (
        <box style={{ flexDirection: "column" }}>
          <box style={{ 
            flexDirection: "column", 
            border: true, 
            borderColor: "#333",
            maxHeight: listHeight + 2,
            overflow: "hidden"
          }}>
            {visibleFiles.map((file, idx) => {
              const actualIdx = startIndex + idx;
              const isSelected = actualIdx === selectedIndex;
              const sizeMB = (file.sizeOriginal / 1024 / 1024).toFixed(2);
              const date = new Date(file.$createdAt).toLocaleDateString();
              
              return (
                <box 
                  key={file.$id} 
                  style={{ 
                    flexDirection: "row", 
                    backgroundColor: isSelected ? "#1a3a1a" : undefined,
                    paddingLeft: 1
                  }}
                >
                  <text fg={isSelected ? "#0F0" : "#666"}>{isSelected ? "▶ " : "  "}</text>
                  <text fg={isSelected ? "#0FF" : "#AAA"} style={{ width: Math.floor(width * 0.4) }}>
                    {file.name.substring(0, 30)}
                  </text>
                  <text fg="#888">{sizeMB}MB</text>
                  <text fg="#666"> {date}</text>
                </box>
              );
            })}
          </box>
          
          <box style={{ flexDirection: "row", marginTop: 1 }}>
            <text fg="#666">[↑/↓] Navigate</text>
            <text fg="#444">  </text>
            <text fg="#666">[Enter] Restore</text>
            <text fg="#444">  </text>
            <text fg="#666">[R] Refresh</text>
          </box>
        </box>
      )}

      {running && (
        <box style={{ flexDirection: "column", gap: 0 }}>
          <text fg="#FFA500">⏳ Restore in progress...</text>
          <ProgressBar
            label="Download"
            progress={downloadProgress}
            width={Math.max(16, Math.floor(width * 0.4))}
            color={phase === "download" ? "#0FF" : "#666"}
          />
          <text fg="#888">
            {`   ${formatBytes(downloadMetrics.downloadedBytes)}${downloadMetrics.totalBytes ? ` / ${formatBytes(downloadMetrics.totalBytes)}` : ""}  •  ${formatSpeed(downloadMetrics.bytesPerSecond)}  •  ETA ${formatEta(downloadMetrics.etaSeconds)}`}
          </text>
          <ProgressBar
            label="Restore "
            progress={restoreProgress}
            width={Math.max(16, Math.floor(width * 0.4))}
            color={phase === "restore" ? "#0F0" : "#666"}
          />
        </box>
      )}

      <LogViewer logs={logs} title="Restore Logs" />
    </box>
  );
}
