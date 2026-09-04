#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readEnvFile } from "./env.mjs";

const [, , envFile, command, ...args] = process.argv;

if (!envFile || !command) {
  console.error(
    "Usage: node tools/run-with-env.mjs <env-file> <command> [...args]",
  );
  process.exit(1);
}

const child = spawn(command, args, {
  cwd: process.cwd(),
  env: {
    ...readEnvFile(envFile),
    ...process.env,
  },
  stdio: "inherit",
});

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

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child.kill(signal);
  });
}
