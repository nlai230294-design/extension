import cors from "cors";
import express from "express";
import { ZodError } from "zod";

import { env } from "./config/env.js";
import analysisRoutes from "./routes/analysis.routes.js";
import sessionRoutes from "./routes/session.routes.js";
import userRoutes from "./routes/user.routes.js";
import { SessionNotFoundError, SessionNotRunningError } from "./services/analysis.service.js";
import { UserNotFoundError } from "./services/dashboard.service.js";
import { createLogger } from "./utils/logger.js";

const logger = createLogger("http");

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json());

  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      logger.info(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
    });
    next();
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/sessions", sessionRoutes);
  app.use("/api/analysis", analysisRoutes);
  app.use("/api/users", userRoutes);

  app.use((req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use((error, req, res, next) => {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.issues });
    }
    if (error instanceof SessionNotFoundError || error instanceof UserNotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    if (error instanceof SessionNotRunningError) {
      return res.status(409).json({ error: error.message });
    }

    logger.error(`${req.method} ${req.originalUrl} failed:`, error);
    return res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
