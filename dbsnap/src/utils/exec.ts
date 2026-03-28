import { spawn } from "bun";

const enc = new TextEncoder();

type RunSudoHooks = {
  onStdoutLine?: (line: string) => void;
  onStderrLine?: (line: string) => void;
};

async function consumeStream(
  stream: ReadableStream<Uint8Array> | null | undefined,
  onLine?: (line: string) => void
): Promise<string> {
  if (!stream) return "";

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let lineBuffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    const chunk = decoder.decode(value, { stream: true });
    fullText += chunk;
    lineBuffer += chunk;

    while (true) {
      const newlineIndex = lineBuffer.indexOf("\n");
      if (newlineIndex === -1) break;

      const line = lineBuffer.slice(0, newlineIndex).replace(/\r$/, "");
      onLine?.(line);
      lineBuffer = lineBuffer.slice(newlineIndex + 1);
    }
  }

  const tail = decoder.decode();
  if (tail) {
    fullText += tail;
    lineBuffer += tail;
  }

  const finalLine = lineBuffer.replace(/\r$/, "");
  if (finalLine.length > 0) {
    onLine?.(finalLine);
  }

  return fullText;
}

export async function runSudo(
  password: string | undefined,
  args: string[],
  onLog?: (log: string) => void,
  hooks?: RunSudoHooks
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

  const stdoutTextPromise = consumeStream(proc.stdout, (line) => {
    if (line.length > 0) {
      onLog?.(line);
    }
    hooks?.onStdoutLine?.(line);
  });

  const stderrTextPromise = consumeStream(proc.stderr, (line) => {
    if (line.length > 0) {
      onLog?.(line);
    }
    hooks?.onStderrLine?.(line);
  });

  const [code, out, err] = await Promise.all([proc.exited, stdoutTextPromise, stderrTextPromise]);

  if (code !== 0) {
    throw new Error(`Command failed (${code}): ${args.join(" ")}\n${err}`);
  }

  return { out, err, code };
}
