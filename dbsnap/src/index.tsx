import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import React from "react";
import { App } from "./app";
import { loadConfig } from "./services/config";
import { takeBackup } from "./services/backup";
import { uploadBackup, getFilesList, downloadBackup, getLatestBackup } from "./services/storage";
import { sendEmail } from "./services/email";
import { restoreSelected } from "./services/restore";
import { runConfigEditor } from "./services/config-editor";
import { cleanupRestoreDownloadPath, createRestoreDownloadPath } from "./services/restore-file";

async function runHeadlessBackup() {
  const config = await loadConfig();
  
  const args = process.argv.slice(2);
  const containerArg = args.find((_, i) => args[i - 1] === "--container");
  const hostArg = args.find((_, i) => args[i - 1] === "--host");
  const portArg = args.find((_, i) => args[i - 1] === "--port");
  
  const runConfig = {
    ...config,
    DOCKER_CONTAINER: containerArg || config.DOCKER_CONTAINER || "",
    DB_HOST: hostArg || "localhost",
    DB_PORT: portArg || "5432",
  };
  
  console.log(`Starting headless backup for container: ${runConfig.DOCKER_CONTAINER}`);
  console.log(`Host: ${runConfig.DB_HOST}, Port: ${runConfig.DB_PORT}`);
  
  try {
    const localPath = await takeBackup(runConfig, "postgres", console.log);
    const fileName = localPath.split("/").pop() ?? "backup.dump";
    const response = await uploadBackup(config, localPath, fileName, console.log);
    const fileUrl = `${config.API_URL}/storage/buckets/${response.bucketId}/files/${response.$id}/view`;
    await sendEmail(config, "Database Snapshot and upload Successful", fileUrl, console.log);
    console.log("✅ Backup and upload complete!");
  } catch (err) {
    console.error("❌ Headless Backup Error:", err);
    process.exit(1);
  }
  process.exit(0);
}

async function runHeadlessRestore(fileId?: string) {
  const config = await loadConfig();
  console.log("Starting headless restore...");
  try {
    let targetId = fileId;

    if (!targetId) {
      console.log("No file ID provided, fetching latest backup...");
      const files = await getFilesList(config, console.log);
      targetId = getLatestBackup(files).$id;
    }

    console.log(`Restoring backup ID: ${targetId}`);
    const localPath = await createRestoreDownloadPath(targetId);
    try {
      await downloadBackup(config, targetId, localPath, console.log);
      await restoreSelected(config, localPath, console.log);
    } finally {
      await cleanupRestoreDownloadPath(localPath);
    }
    console.log("✅ Restore complete!");
  } catch (err) {
    console.error("❌ Headless Restore Error:", err);
    process.exit(1);
  }
  process.exit(0);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--config")) {
    await runConfigEditor();
    return;
  }

  if (args.includes("--backup") || args.includes("--run")) {
    await runHeadlessBackup();
    return;
  }

  if (args.includes("--restore")) {
    const restoreIndex = args.indexOf("--restore");
    const fileId = args[restoreIndex + 1];
    await runHeadlessRestore(fileId && !fileId.startsWith("--") ? fileId : undefined);
    return;
  }

  // Start OpenTUI App
  const renderer = await createCliRenderer();
  createRoot(renderer).render(<App />);
}

main();
