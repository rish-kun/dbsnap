import { runSudo } from "../utils/exec";

type RestoreProgressHooks = {
  onStageProgress?: (progress: number) => void;
};

function asSqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function asSqlIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export async function restoreSelected(
  config: Record<string, string>,
  localBackupPath: string,
  onLog?: (msg: string) => void,
  hooks?: RestoreProgressHooks
) {
  const container = (config.DOCKER_CONTAINER ?? "").trim();
  const password = config.SCRIPT_PASSWORD;
  const dbName = (config.DB_NAME ?? "postgres").trim() || "postgres";
  const dbUser = (config.DB_USER ?? "postgres").trim() || "postgres";
  const maintenanceDb = dbName === "postgres" ? "template1" : "postgres";
  const pgOptions = "-c lock_timeout=10s -c statement_timeout=30min";

  if (!container) {
    throw new Error("DOCKER_CONTAINER is not set in config. Set it in --config or .env before running restore.");
  }

  if (onLog) {
    onLog(`Restoring file: ${localBackupPath} into container ${container}`);
    onLog(`Target DB: ${dbName} (user: ${dbUser})`);
  }

  hooks?.onStageProgress?.(0);

  const progressByStep = (step: number, total: number) => {
    const next = Math.floor((step / total) * 100);
    hooks?.onStageProgress?.(Math.min(99, Math.max(0, next)));
  };

  const createPgRestoreTracker = (start: number, end: number) => {
    let current = start;
    let signalCount = 0;

    return (line: string) => {
      const isSignalLine =
        line.startsWith("pg_restore: creating ") ||
        line.startsWith("pg_restore: processing ") ||
        line.startsWith("pg_restore: executing ");

      if (!isSignalLine) return;

      signalCount += 1;
      if (signalCount % 3 !== 0) return;

      if (current < end) {
        current += 1;
        hooks?.onStageProgress?.(current);
      }
    };
  };

  await runSudo(password, [
    "docker",
    "cp",
    `${localBackupPath}`,
    `${container}:/backup.dump`,
  ], onLog);
  progressByStep(1, 6);

  if (onLog) onLog(`✅ File copied to container successfully`);

  if (onLog) onLog(`🔓 Terminating existing connections to ${dbName} before restore...`);
  await runSudo(password, [
    "docker",
    "exec",
    container,
    "psql",
    "-U",
    dbUser,
    "-d",
    maintenanceDb,
    "-c",
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${asSqlLiteral(dbName)} AND pid <> pg_backend_pid();`,
  ], onLog);
  progressByStep(2, 6);

  try {
    const trackPrimaryRestore = createPgRestoreTracker(35, 95);

    await runSudo(password, [
      "docker",
      "exec",
      "-e",
      `PGOPTIONS=${pgOptions}`,
      container,
      "pg_restore",
      "-U",
      dbUser,
      "-d",
      dbName,
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-privileges",
      "--verbose",
      "/backup.dump",
    ], onLog, {
      onStderrLine: trackPrimaryRestore,
      onStdoutLine: trackPrimaryRestore,
    });

    progressByStep(6, 6);
    if (onLog) onLog(`✅ Database restored successfully.`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (onLog) {
      onLog(`❌ Database restore failed. Reason: ${reason}`);
      onLog(`⚠️ Trying force drop/create approach for ${dbName}...`);
    }
    hooks?.onStageProgress?.(45);

    await runSudo(password, [
      "docker",
      "exec",
      container,
      "psql",
      "-U",
      dbUser,
      "-d",
      maintenanceDb,
      "-c",
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${asSqlLiteral(dbName)} AND pid <> pg_backend_pid();`,
    ], onLog);
    hooks?.onStageProgress?.(55);

    await runSudo(password, [
      "docker",
      "exec",
      container,
      "psql",
      "-U",
      dbUser,
      "-d",
      maintenanceDb,
      "-c",
      `DROP DATABASE IF EXISTS ${asSqlIdentifier(dbName)} WITH (FORCE);`,
    ], onLog);
    hooks?.onStageProgress?.(65);

    await runSudo(password, [
      "docker",
      "exec",
      container,
      "psql",
      "-U",
      dbUser,
      "-d",
      maintenanceDb,
      "-c",
      `CREATE DATABASE ${asSqlIdentifier(dbName)};`,
    ], onLog);
    hooks?.onStageProgress?.(75);

    const trackFallbackRestore = createPgRestoreTracker(80, 99);

    await runSudo(password, [
      "docker",
      "exec",
      "-e",
      `PGOPTIONS=${pgOptions}`,
      container,
      "pg_restore",
      "-U",
      dbUser,
      "-d",
      dbName,
      "--no-owner",
      "--no-privileges",
      "--verbose",
      "/backup.dump",
    ], onLog, {
      onStderrLine: trackFallbackRestore,
      onStdoutLine: trackFallbackRestore,
    });

    progressByStep(6, 6);
    if (onLog) onLog(`✅ Database restored successfully via drop/create.`);
  } finally {
    try {
      await runSudo(password, ["docker", "exec", container, "rm", "-f", "/backup.dump"]);
    } catch {
      // no-op
    }
  }

  hooks?.onStageProgress?.(100);
}
