import React from "react";

interface ProgressBarProps {
  label: string;
  progress: number;
  width?: number;
  color?: string;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function ProgressBar({ label, progress, width = 32, color = "#0FF" }: ProgressBarProps) {
  const safeProgress = clampPercent(progress);
  const safeWidth = Math.max(10, Math.floor(width));
  const filled = Math.round((safeProgress / 100) * safeWidth);
  const bar = `${"=".repeat(filled)}${"-".repeat(Math.max(0, safeWidth - filled))}`;

  return (
    <text fg={color}>{`${label} [${bar}] ${safeProgress.toString().padStart(3, " ")}%`}</text>
  );
}
