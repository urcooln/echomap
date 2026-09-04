#!/usr/bin/env node
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readEnvFile } from "./env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const child = spawn(
  "pnpm",
  [
    "-C",
    "scripts",
    "exec",
    "tsx",
    "../artifacts/api-server/src/scripts/seed-development-demo.ts",
  ],
  {
    cwd: root,
    env: {
      ...readEnvFile("artifacts/api-server/.env", root),
      ...process.env,
      NODE_ENV: "development",
    },
    stdio: "inherit",
  },
);

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
