import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const validEnvKey = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const readEnvFile = (filePath, cwd = process.cwd()) => {
  const resolvedPath = resolve(cwd, filePath);

  if (!existsSync(resolvedPath)) {
    return {};
  }

  const values = {};
  const raw = readFileSync(resolvedPath, "utf8");

  for (const line of raw.split(/\r?\n/)) {
    let trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("export ")) trimmed = trimmed.slice(7).trim();

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    if (!validEnvKey.test(key)) continue;

    let value = trimmed.slice(separator + 1).trim();
    const quote = value[0];

    if (
      (quote === '"' || quote === "'") &&
      value.length >= 2 &&
      value[value.length - 1] === quote
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }

    values[key] = value;
  }

  return values;
};
