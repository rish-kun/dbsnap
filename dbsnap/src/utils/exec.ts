import { spawn } from "bun";

const enc = new TextEncoder();

export async function runSudo(
  password: string | undefined,
  args: string[],
  onLog?: (log: string) => void
) {
  const cmd = password ? ["sudo", "-S", "-p", "", ...args] : args;

  const options: any = {
    stdout: "pipe",
    stderr: "pipe",
  };

  if (password) {
    options.stdin = enc.encode(password + "\n");
  }

  const proc = spawn(cmd, options);

  if (onLog) {
    onLog(`> ${cmd.join(" ")}`);
  }

  const [code, out, err] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  if (onLog) {
    if (out) onLog(out);
    if (err) onLog(`Error: ${err}`);
  }

  if (code !== 0) {
    throw new Error(`Command failed (${code}): ${args.join(" ")}\n${err}`);
  }

  return { out, err, code };
}
