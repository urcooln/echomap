import { defineConfig } from "vite";
import type { PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { mockupPreviewPlugin } from "./mockupPreviewPlugin";

const parsePort = (rawPort: string | undefined, fallback: number) => {
  if (!rawPort) return fallback;

  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  return port;
};

const loadOptionalVitePlugin = async (
  specifier: string,
  createPlugin: (module: Record<string, any>) => PluginOption,
): Promise<PluginOption> => {
  try {
    return createPlugin(await import(specifier));
  } catch {
    return null;
  }
};

const port = parsePort(process.env.PORT, 5174);
const basePath = process.env.BASE_PATH || "/";
const runtimeErrorOverlay = await loadOptionalVitePlugin(
  "@replit/vite-plugin-runtime-error-modal",
  (module) => {
    const createRuntimeErrorOverlay = module.default ?? module;
    return typeof createRuntimeErrorOverlay === "function"
      ? createRuntimeErrorOverlay()
      : null;
  },
);
const replitPlugins =
  process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined
    ? [
        await loadOptionalVitePlugin(
          "@replit/vite-plugin-cartographer",
          (module) =>
            typeof module.cartographer === "function"
              ? module.cartographer({
                  root: path.resolve(import.meta.dirname, ".."),
                })
              : null,
        ),
      ]
    : [];

export default defineConfig({
  base: basePath,
  plugins: [
    mockupPreviewPlugin(),
    react(),
    tailwindcss(),
    runtimeErrorOverlay,
    ...replitPlugins,
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
