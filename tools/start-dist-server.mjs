import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Load env file
try {
  const envPath = join(process.cwd(), 'artifacts/api-server/.env');
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    let val = trimmed.slice(eq + 1);
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    process.env[key] = val;
  }
} catch (err) {
  // ignore
}

// Ensure PORT is set; default to 4001 if not provided
if (!process.env.PORT) process.env.PORT = '4001';

// Import the compiled server bundle which will start listening
import('../artifacts/api-server/dist/index.mjs');
