import type { IncomingHttpHeaders } from "node:http";
import type { RequestHandler } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

const clerkFrontendApi = process.env.CLERK_FRONTEND_API || "https://frontend-api.clerk.dev";
export const CLERK_PROXY_PATH = "/api/__clerk";

export const getClerkProxyHost = (request: { headers: IncomingHttpHeaders }) => {
  const forwarded = request.headers["x-forwarded-host"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return raw?.split(",")[0]?.trim() || request.headers.host?.trim() || undefined;
};

/**
 * Clerk's production Frontend API proxy. It deliberately runs before body
 * parsing so auth requests remain byte-for-byte intact.
 */
export const clerkProxyMiddleware = (): RequestHandler => {
  const isProd = process.env.NODE_ENV === "production";
  const allowDevProxy = process.env.CLERK_ALLOW_DEV_PROXY === "true";

  // Enable proxy in production when CLERK_SECRET_KEY is set, or explicitly
  // enable in development with CLERK_ALLOW_DEV_PROXY=true. This makes local
  // development easier without flipping NODE_ENV to production.
  if (!(isProd && process.env.CLERK_SECRET_KEY) && !allowDevProxy) {
    return (_request, _response, next) => next();
  }

  return createProxyMiddleware({
    target: clerkFrontendApi,
    changeOrigin: true,
    selfHandleResponse: true,
    pathRewrite: (requestPath) =>
      requestPath.replace(new RegExp(`^${CLERK_PROXY_PATH}`), ""),
    on: {
      proxyReq: (proxyRequest, request) => {
        // Default to https in production, but use http for local development
        const protocolHeader = request.headers["x-forwarded-proto"];
        const protocol =
          protocolHeader || (process.env.NODE_ENV === "production" ? "https" : "http");
        const host = getClerkProxyHost(request) || "";
        proxyRequest.setHeader("Clerk-Proxy-Url", `${protocol}://${host}${CLERK_PROXY_PATH}`);
        // Only set the secret header when available (may be omitted in local dev).
        if (process.env.CLERK_SECRET_KEY) {
          proxyRequest.setHeader("Clerk-Secret-Key", process.env.CLERK_SECRET_KEY);
        }
      },
      proxyRes: (proxyResponse, request, response) => {
        const headers = { ...proxyResponse.headers };
        delete headers["transfer-encoding"];
        delete headers.connection;
        delete headers["keep-alive"];

        const status = proxyResponse.statusCode ?? 502;
        const bodyless = request.method === "HEAD" || status < 200 || status === 204 || status === 304;
        if (bodyless) delete headers["content-length"];
        if (headers["content-length"] !== undefined || bodyless) {
          response.writeHead(status, headers);
          proxyResponse.on("error", () => response.destroy());
          proxyResponse.pipe(response);
          return;
        }

        const chunks: Buffer[] = [];
        proxyResponse.on("data", (chunk: Buffer) => chunks.push(chunk));
        proxyResponse.on("end", () => {
          const body = Buffer.concat(chunks);
          headers["content-length"] = String(body.length);
          response.writeHead(status, headers);
          response.end(body);
        });
        proxyResponse.on("error", () => {
          if (!response.headersSent) response.writeHead(502, { "content-length": "0" });
          response.end();
        });
      },
    },
  }) as RequestHandler;
};