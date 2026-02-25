import { $ } from "bun";
import path from "path";

export interface CronJobResult {
  container: string;
  expression: string;
  command: string;
}

export async function setupCronJob(
  cronExpression: string,
  dockerContainer: string,
  dbHostType: "local" | "remote",
  port: string,
  onLog?: (msg: string) => void
) {
  const rootDir = path.resolve(import.meta.dir, "../../");
  const binaryPath = path.join(rootDir, "dbsnap");
  const logPath = path.join(rootDir, "../dbsnap.log");
  
  const host = dbHostType === "local" ? "localhost" : "db";
  const command = `cd ${rootDir} && ${binaryPath} --run --container ${dockerContainer} --host ${host} --port ${port} >> ${logPath} 2>&1`;
  const cronLine = `${cronExpression} ${command}`;

  try {
    const currentCrontab = await $`crontab -l`.quiet().text().catch(() => "");
    
    const newCrontabLines = currentCrontab
      .split("\n")
      .filter(line => {
        if (!line.trim()) return false;
        if (line.includes(binaryPath) && line.includes(`--container ${dockerContainer}`)) return false;
        if (line.includes("dbsnap/index.ts")) return false;
        return true;
      });
    
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

export async function listCronJobs(onLog?: (msg: string) => void): Promise<CronJobResult[]> {
  const rootDir = path.resolve(import.meta.dir, "../../");
  const binaryPath = path.join(rootDir, "dbsnap");
  
  try {
    const currentCrontab = await $`crontab -l`.quiet().text().catch(() => "");
    const jobs: CronJobResult[] = [];
    
    const lines = currentCrontab.split("\n").filter(line => 
      line.includes(binaryPath) && line.includes("--run")
    );
    
    for (const line of lines) {
      const match = line.match(/^(.+?\s+.+?\s+.+?\s+.+?\s+.+?)\s+.*--container\s+(\S+)/);
      if (match && match[1] && match[2]) {
        jobs.push({
          expression: match[1],
          container: match[2],
          command: line,
        });
      }
    }
    
    return jobs;
  } catch (err) {
    if (onLog) onLog(`❌ Failed to list cron jobs: ${err}`);
    return [];
  }
}

export async function removeCronJob(
  dockerContainer: string,
  onLog?: (msg: string) => void
) {
  const rootDir = path.resolve(import.meta.dir, "../../");
  const binaryPath = path.join(rootDir, "dbsnap");
  
  try {
    const currentCrontab = await $`crontab -l`.quiet().text().catch(() => "");
    
    const newCrontabLines = currentCrontab
      .split("\n")
      .filter(line => {
        if (!line.trim()) return false;
        if (line.includes(binaryPath) && line.includes(`--container ${dockerContainer}`)) return false;
        return true;
      });
    
    const finalCrontab = newCrontabLines.join("\n") + "\n";
    
    const proc = Bun.spawn(["crontab", "-"], {
      stdin: new TextEncoder().encode(finalCrontab),
    });
    await proc.exited;
    
    if (onLog) onLog(`✅ Cron job for ${dockerContainer} removed`);
    return true;
  } catch (err) {
    if (onLog) onLog(`❌ Failed to remove cron job: ${err}`);
    return false;
  }
}
