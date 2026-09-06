import path from "node:path";
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import { runtimeConfig } from "./lib/runtime-config";
import { attachClerkActor } from "./lib/clerk-auth-middleware";
import { attachDevelopmentDemoActor } from "./lib/development-demo";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

const app: Express = express();
const production = runtimeConfig.isProduction;

app.set("trust proxy", 1);
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), geolocation=(), payment=()");
  res.setHeader("Cache-Control", "no-store");
  if (production) {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
    if (req.get("x-forwarded-proto") !== "https") {
      return res.redirect(308, `https://${req.get("host")}${req.originalUrl}`);
    }
  }
  return next();
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(
  cors({
    credentials: true,
    origin: production ? runtimeConfig.allowedOrigins : true,
  }),
);
app.use(cookieParser(process.env.SESSION_SECRET));
app.use(
  clerkMiddleware((request) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(request) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);
app.use(attachClerkActor);
app.use(attachDevelopmentDemoActor);
app.use(express.json({ limit: "32mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

if (production) {
  const staticClientDir = path.resolve(
    process.env.CHILDLED_STATIC_DIR?.trim() ||
      path.join(process.cwd(), "dist", "public"),
  );

  app.use(
    express.static(staticClientDir, {
      fallthrough: true,
      index: false,
      setHeaders(res, filePath) {
        res.setHeader(
          "Cache-Control",
          filePath.endsWith("index.html") ? "no-store" : "public, max-age=3600",
        );
      },
    }),
  );

  app.use((req, res, next) => {
    if (!["GET", "HEAD"].includes(req.method) || req.path.startsWith("/api")) {
      return next();
    }
    return res.sendFile(path.join(staticClientDir, "index.html"));
  });
}

export default app;
