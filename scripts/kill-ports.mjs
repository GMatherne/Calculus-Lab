/**
 * Stops Vite servers an agent left running, while leaving YOUR dev server alone.
 * Port 5173 is protected by default (edit PROTECTED_PORTS below to change this).
 *
 * Usage:
 *   npm run kill-ports            Stop agent-started Vite servers (keeps 5173).
 *   npm run kill-ports -- 5277    Also force-free specific port(s). This overrides
 *                                 protection, so `-- 5173` will stop 5173 too.
 *
 * Runs from any shell (PowerShell, Git Bash, cmd, bash, zsh): it goes through
 * Node and handles the platform-specific process lookups/kills internally.
 */
import { execSync } from "node:child_process";

const isWindows = process.platform === "win32";
const repoRoot = process.cwd().replace(/\\/g, "/").toLowerCase();
const requestedPorts = process.argv
  .slice(2)
  .flatMap((arg) => arg.split(/[\s,]+/))
  .map((arg) => arg.trim())
  .filter((arg) => /^\d+$/.test(arg));

function run(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }) ?? "";
  } catch {
    // A non-zero exit (e.g. "no matching process") is expected; treat as empty.
    return "";
  }
}

/** Build a map of pid -> Set<port> for everything currently LISTENING. */
function listeningByPid() {
  const map = new Map();
  const add = (pid, port) => {
    if (!map.has(pid)) map.set(pid, new Set());
    map.get(pid).add(port);
  };

  if (isWindows) {
    // Note: no "-p tcp" — that hides IPv6, and Vite listens on [::1].
    for (const line of run("netstat -ano").split(/\r?\n/)) {
      const m = line.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/i);
      if (m) add(m[2], m[1]);
    }
  } else {
    for (const line of run("lsof -nP -iTCP -sTCP:LISTEN").split(/\r?\n/)) {
      const m = line.match(/^\S+\s+(\d+)\s+.*:(\d+)\s+\(LISTEN\)/);
      if (m) add(m[1], m[2]);
    }
  }
  return map;
}

/** Node processes whose command line is this project's Vite (dev or preview). */
function projectViteProcesses() {
  const procs = [];

  if (isWindows) {
    const json = run(
      'powershell -NoProfile -Command "Get-CimInstance Win32_Process | ' +
        "Where-Object { $_.Name -eq 'node.exe' } | " +
        'Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress"'
    );
    if (json.trim()) {
      let parsed;
      try {
        parsed = JSON.parse(json);
      } catch {
        parsed = [];
      }
      const list = Array.isArray(parsed) ? parsed : [parsed];
      for (const p of list) {
        if (p && p.CommandLine) procs.push({ pid: String(p.ProcessId), command: p.CommandLine });
      }
    }
  } else {
    for (const line of run("ps -ax -o pid=,command=").split(/\r?\n/)) {
      const trimmed = line.trim();
      const space = trimmed.indexOf(" ");
      if (space > 0) procs.push({ pid: trimmed.slice(0, space), command: trimmed.slice(space + 1) });
    }
  }

  // Match "vite/bin/vite.js" (covers dev + preview) for THIS project only.
  // Matching the path avoids killing unrelated Vite projects or "vitest" runners.
  return procs.filter(({ command }) => {
    const c = command.replace(/\\/g, "/").toLowerCase();
    return c.includes("vite/bin/vite.js") && c.includes(repoRoot);
  });
}

function kill(pid) {
  if (isWindows) run(`taskkill /F /T /PID ${pid}`);
  else run(`kill -9 ${pid}`);
}

// Ports that are yours and must never be auto-killed. An explicit
// `npm run kill-ports -- <port>` still overrides this on purpose.
const PROTECTED_PORTS = new Set(["5173"]);

const portsByPid = listeningByPid();

/** A Vite process's port, from netstat, its --port flag, or the Vite default. */
function effectivePorts(pid, command) {
  const ports = new Set(portsByPid.get(pid) ?? []);
  for (const m of command.matchAll(/--port[=\s]+(\d+)/gi)) ports.add(m[1]);
  if (ports.size === 0) ports.add(/\bpreview\b/i.test(command) ? "5174" : "5173");
  return ports;
}

const fmt = (ports) => [...ports].sort((a, b) => Number(a) - Number(b)).join(", ") || "unknown";

const targets = new Map(); // pid -> Set<port>  (will be killed)
const skipped = new Map(); // pid -> Set<port>  (protected, left running)

// Auto-detected Vite servers for this project — but never the protected ports.
for (const { pid, command } of projectViteProcesses()) {
  const ports = effectivePorts(pid, command);
  if ([...ports].some((port) => PROTECTED_PORTS.has(port))) skipped.set(pid, ports);
  else targets.set(pid, ports);
}

// Explicitly requested ports are killed even if protected.
for (const [pid, ports] of portsByPid) {
  if ([...ports].some((port) => requestedPorts.includes(port))) {
    targets.set(pid, new Set([...(targets.get(pid) ?? []), ...ports]));
    skipped.delete(pid);
  }
}

for (const [pid, ports] of skipped) {
  console.log(`Skipped PID ${pid} (port ${fmt(ports)}, protected).`);
}

if (targets.size === 0) {
  const extra = requestedPorts.length ? ` (and nothing on port ${requestedPorts.join(", ")})` : "";
  console.log(`No agent-started Vite servers to stop${extra}.`);
  process.exit(0);
}

for (const [pid, ports] of targets) {
  kill(pid);
  console.log(`Stopped PID ${pid} (port ${fmt(ports)}).`);
}
console.log(`Done — stopped ${targets.size} process(es).`);
