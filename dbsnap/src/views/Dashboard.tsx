import React, { useState, useEffect } from "react";
import { useTerminalDimensions } from "@opentui/react";
import { getDockerContainers } from "../services/docker";

export function DashboardView({ config }: { config: Record<string, string> }) {
  const [containers, setContainers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { width } = useTerminalDimensions();

  useEffect(() => {
    getDockerContainers().then(res => {
      setContainers(res);
      setLoading(false);
    });
  }, []);

  const labelWidth = Math.min(20, Math.floor(width * 0.2));

  return (
    <box style={{ flexDirection: "column", gap: 1, height: "100%", overflow: "hidden" }}>
      <text fg="#00FF00" bold>🚀 Welcome to DBSnap CLI</text>
      <text fg="#888">Your independent TUI tool for database backups and restores.</text>

      <box style={{ marginTop: 1, flexDirection: "column", gap: 0 }}>
        <text fg="#FFA500" bold>─── System Overview ───</text>
        <box style={{ flexDirection: "row" }}>
          <text fg="#666" style={{ width: labelWidth }}>Target Container:</text>
          <text fg={config.DOCKER_CONTAINER ? "#0FF" : "#F55"}>{config.DOCKER_CONTAINER || "Not set"}</text>
        </box>
        <box style={{ flexDirection: "row" }}>
          <text fg="#666" style={{ width: labelWidth }}>Appwrite Endpoint:</text>
          <text fg={config.API_URL ? "#0FF" : "#F55"}>{config.API_URL || "Not set"}</text>
        </box>
        <box style={{ flexDirection: "row" }}>
          <text fg="#666" style={{ width: labelWidth }}>Project ID:</text>
          <text fg={config.PROJECT_ID ? "#0F0" : "#F55"}>{config.PROJECT_ID ? "✓ Configured" : "Not set"}</text>
        </box>
        <box style={{ flexDirection: "row" }}>
          <text fg="#666" style={{ width: labelWidth }}>SendGrid Email:</text>
          <text fg={config.SENDGRID_API_KEY ? "#0F0" : "#F55"}>{config.SENDGRID_API_KEY ? "✓ Configured" : "Not set"}</text>
        </box>
      </box>

      <box style={{ marginTop: 1, flexDirection: "column", gap: 0, flexGrow: 1 }}>
        <text fg="#00A5FF" bold>─── Detected Postgres Containers ───</text>
        <box style={{ flexDirection: "column", flexGrow: 1, overflow: "hidden" }}>
          {loading ? (
            <text fg="#FFA500">Loading containers...</text>
          ) : containers.length > 0 ? (
            containers.slice(0, 5).map(c => (
              <text key={c} fg="#0FF">  • {c}</text>
            ))
          ) : (
            <text fg="#F55">  No docker containers found. Is Docker running?</text>
          )}
        </box>
      </box>
    </box>
  );
}
