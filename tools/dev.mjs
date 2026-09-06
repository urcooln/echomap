#!/usr/bin/env node
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readEnvFile } from "./env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const apiPort = process.env.API_PORT || "3001";
const webPort = process.env.WEB_PORT || process.env.PORT || "5173";
const basePath = process.env.BASE_PATH || "/";
const devApiOrigin =
  process.env.DEV_API_ORIGIN || `http://localhost:${apiPort}`;

const apiEnv = {
  ...readEnvFile("artifacts/api-server/.env", root),
  ...process.env,
  NODE_ENV: "development",
  PORT: apiPort,
};

const webEnv = {
  ...readEnvFile("artifacts/childled/.env", root),
  ...process.env,
  NODE_ENV: "development",
  PORT: webPort,
  BASE_PATH: basePath,
  DEV_API_ORIGIN: devApiOrigin,
};

const children = new Set();
let shuttingDown = false;

const writePrefixed = (name, stream, output) => {
  let buffered = "";

  stream.on("data", (chunk) => {
    buffered += chunk.toString();
    const lines = buffered.split(/\r?\n/);
    buffered = lines.pop() ?? "";

    for (const line of lines) {
      output.write(line ? `[${name}] ${line}\n` : "\n");
    }
  });

  stream.on("end", () => {
    if (buffered) output.write(`[${name}] ${buffered}\n`);
  });
};

const stopAll = (exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }

  setTimeout(() => process.exit(exitCode), 500).unref();
};

const start = (name, args, env) => {
  const child = spawn("pnpm", args, {
    cwd: root,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  children.add(child);
  writePrefixed(name, child.stdout, process.stdout);
  writePrefixed(name, child.stderr, process.stderr);

  child.on("error", (error) => {
    console.error(`[${name}] ${error.message}`);
    stopAll(1);
  });

  child.on("exit", (code, signal) => {
    children.delete(child);
    if (shuttingDown) return;

    const reason = signal ? `signal ${signal}` : `exit code ${code ?? 0}`;
    console.error(`[${name}] stopped with ${reason}`);
    stopAll(code ?? 1);
  });
};

console.log(`Starting ChildLed API on http://localhost:${apiPort}`);
console.log(`Starting ChildLed web app on http://localhost:${webPort}`);

start("api", ["--filter", "@workspace/api-server", "dev"], apiEnv);
start("web", ["--filter", "@workspace/childled", "dev"], webEnv);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => stopAll(0));
}
