import { $ } from "bun";
const enc = new TextEncoder();

async function runSudo(password: string, args: string[]) {
  const proc = Bun.spawn(["sudo", "-S", "-p", "", ...args], {
    stdin: enc.encode(password + "\n"),
    stdout: "pipe",
    stderr: "pipe",
  });

  const [code, out, err] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  if (code !== 0) {
    throw new Error(`Command failed (${code}): ${args.join(" ")}\n${err}`);
  }

  return { out, err, code };
}

export default async function takeBackup(dbname: string = "postgres") {
  const date = new Date();
  const timestamp = date.toISOString().replace(/[:.]/g, "-");
  const backupFileName = `${dbname}-backup-${timestamp}.sql`;
  const container = "Oasis_2025-postgres";
  const tmpPath = "backup.dump";
  const password = process.env.SCRIPT_PASSWORD || "your_password_here";

  // Color codes
  const colors = {
    reset: "\x1b[0m",
    blue: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    magenta: "\x1b[35m",
  };

  await $`mkdir -p ./backups`;

  console.log(
    `${colors.blue}🚀 Starting backup for database: ${dbname}${colors.reset}`
  );

  const proc = Bun.spawn({
    cmd: [
      "sudo",
      "-S",
      "-p",
      "",
      "docker",
      "exec",
      container,
      "pg_dump",
      "-U",
      "postgres",
      "-Fc",
      "-f",
      tmpPath,
      "postgres",
    ],
    stdin: new TextEncoder().encode(password + "\n"),
    stdout: "pipe",
    stderr: "pipe",
  });

  // Wait for the process to complete
  await proc.exited;
  console.log(
    `${colors.yellow}⚙️  Backup process finished inside the container...${colors.reset}`
  );

  // Copy backup file out of the container
  await runSudo(password, [
    "docker",
    "cp",
    `${container}:${tmpPath}`,
    `./backups/${backupFileName}`,
  ]);
  console.log(
    `${colors.green}✅ Backup taken: ./backups/${backupFileName}${colors.reset}`
  );

  // Remove temp file inside the container
  await runSudo(password, ["docker", "exec", container, "rm", tmpPath]);
  console.log(
    `${colors.magenta}🧹 Temporary backup file removed: ${tmpPath}${colors.reset}`
  );
}

takeBackup();
