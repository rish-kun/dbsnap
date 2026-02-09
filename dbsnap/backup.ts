import { $ } from "bun";
const enc = new TextEncoder();

async function runSudo(password: string | undefined, args: string[]) {
  const cmd = password
    ? ["sudo", "-S", "-p", "", ...args]
    : args;

  const options: any = {
    stdout: "pipe",
    stderr: "pipe",
  };

  if (password) {
    options.stdin = enc.encode(password + "\n");
  }

  const proc = Bun.spawn(cmd, options);

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

export default async function takeBackup(
  dbname: string = "postgres",
  container: string = "Oasis_2025-postgres"
) {
  const date = new Date();
  const timestamp = date.toISOString().replace(/[:.]/g, "-");
  const backupFileName = `${dbname}-backup-${timestamp
    .replace(/T/, "_")
    .replace(/Z$/, "")}.sql`;
  const tmpPath = "backup.dump";
  const password = process.env.SCRIPT_PASSWORD;

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
    `${colors.blue}🚀 Starting backup for database: ${dbname} in container ${container}${colors.reset}`
  );

  const dumpCmd = [
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
  ];

  await runSudo(password, dumpCmd);

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

  try {
    // Remove temp file inside the container
    await runSudo(password, ["docker", "exec", container, "rm", tmpPath]);
    console.log(
      `${colors.magenta}🧹 Temporary backup file removed: ${tmpPath}${colors.reset}`
    );
  } catch (err) {
    console.log(
      `${colors.magenta}⚠️  Could not remove temporary backup file: ${tmpPath}${colors.reset}`
    );
  }
  return `./backups/${backupFileName}`;
}

// takeBackup();
