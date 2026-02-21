import { $ } from "bun";
import path from "path";

export async function setupCronJob(
  cronExpression: string,
  onLog?: (msg: string) => void
) {
  const rootDir = path.resolve(import.meta.dir, "../../");
  const binaryPath = path.join(rootDir, "dbsnap");
  const logPath = path.join(rootDir, "../dbsnap.log");
  
  const command = `cd ${rootDir} && ${binaryPath} --run >> ${logPath} 2>&1`;
  const cronLine = `${cronExpression} ${command}`;

  try {
    const currentCrontab = await $`crontab -l`.quiet().text().catch(() => "");
    
    // Filter out existing dbsnap jobs to avoid duplicates (loose matching)
    const newCrontabLines = currentCrontab
      .split("\n")
      .filter(line => !line.includes(binaryPath) && !line.includes("dbsnap/index.ts") && line.trim() !== "");
    
    newCrontabLines.push(cronLine);
    const finalCrontab = newCrontabLines.join("\n") + "\n";
    
    const proc = Bun.spawn(["crontab", "-"], {
      stdin: new TextEncoder().encode(finalCrontab),
    });
    await proc.exited;
    
    if (onLog) onLog(`✅ Cron job updated: ${cronLine}`);
    return true;
  } catch (err) {
    if (onLog) onLog(`❌ Failed to update crontab: ${err}`);
    return false;
  }
}
