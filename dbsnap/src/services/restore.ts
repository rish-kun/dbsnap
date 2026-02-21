import { runSudo } from "../utils/exec";

export async function restoreSelected(
  config: Record<string, string>,
  localBackupPath: string,
  onLog?: (msg: string) => void
) {
  const container = config.DOCKER_CONTAINER || "Oasis_2025-postgres";
  const password = config.SCRIPT_PASSWORD;

  if (onLog) onLog(`Restoring file: ${localBackupPath} into container ${container}`);

  await runSudo(password, [
    "docker",
    "cp",
    `${localBackupPath}`,
    `${container}:/backup.dump`,
  ], onLog);

  if (onLog) onLog(`✅ File copied to container successfully`);

  try {
    await runSudo(password, [
      "docker",
      "exec",
      container,
      "pg_restore",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "--clean",
      "--if-exists",
      "-j",
      "4",
      "/backup.dump",
    ], onLog);
    
    if (onLog) onLog(`✅ Database restored successfully.`);
  } catch (error) {
    if (onLog) onLog(`❌ Database restore failed. Trying drop/create approach.`);
    
    await runSudo(password, [
      "docker",
      "exec",
      `${container}`,
      "psql",
      "-U",
      "postgres",
      "-c",
      '"DROP DATABASE IF EXISTS postgres WITH (FORCE);"',
    ], onLog);
    
    await runSudo(password, [
      "docker",
      "exec",
      `${container}`,
      "psql",
      "-U",
      "postgres",
      "-c",
      '"CREATE DATABASE postgres;"',
    ], onLog);
    
    await runSudo(password, [
      "docker",
      "exec",
      `${container}`,
      "pg_restore",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-j",
      "4",
      "/backup.dump",
    ], onLog);
    
    if (onLog) onLog(`✅ Database restored successfully via drop/create.`);
  }
}
