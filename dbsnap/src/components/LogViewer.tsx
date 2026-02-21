import React from "react";
import { useTerminalDimensions } from "@opentui/react";

interface LogViewerProps {
  logs: string[];
  title?: string;
  maxHeight?: number;
}

export function LogViewer({ logs, title = "Logs", maxHeight }: LogViewerProps) {
  const { height } = useTerminalDimensions();
  const defaultMaxHeight = Math.max(8, Math.floor(height / 3));
  const actualMaxHeight = maxHeight || defaultMaxHeight;
  const visibleLogs = logs.slice(-actualMaxHeight);
  
  return (
    <box 
      title={title} 
      style={{ 
        border: true, 
        flexDirection: "column",
        width: "100%",
        flexGrow: 1,
        maxHeight: actualMaxHeight + 3,
        padding: 1,
        borderColor: "#333",
        overflow: "hidden"
      }}
    >
      {visibleLogs.length === 0 ? (
        <text fg="#444">No logs yet...</text>
      ) : (
        visibleLogs.map((log, i) => {
          let color = "#AAA";
          if (log.includes("✅") || log.includes("Complete")) color = "#0F0";
          else if (log.includes("❌") || log.includes("Error")) color = "#F55";
          else if (log.includes("⚠️") || log.includes("Warning")) color = "#FA0";
          else if (log.includes("🚀") || log.includes("Starting")) color = "#0FF";
          
          return <text key={i} fg={color}>{log}</text>;
        })
      )}
    </box>
  );
}
