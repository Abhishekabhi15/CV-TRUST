/**
 * CV-TRUST Server Entry Point
 * Connects to MongoDB, starts the HTTP server, handles graceful shutdown.
 */

require("dotenv").config();

const app = require("./app");
const config = require("./config");
const logger = require("./utils/logger");
const { connectDB, disconnectDB } = require("./services/db");

const PORT = process.env.PORT || config.port;
const HOST = process.env.HOST || "0.0.0.0";

async function start() {
  // Connect to MongoDB (non-fatal if unavailable — health endpoint will report degraded)
  try {
    await connectDB();
  } catch (err) {
    logger.warn(
      `MongoDB unavailable at startup: ${err.message}. Continuing without DB.`,
    );
  }

  const server = app.listen(PORT, HOST, () => {
    logger.info(
      `CV-TRUST backend running on ${HOST}:${PORT} [${config.nodeEnv}]`,
    );
    logger.info(`Health check: http://${HOST}:${PORT}/api/health`);
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal) => {
    logger.info(`${signal} received — shutting down gracefully`);

    server.close(async () => {
      await disconnectDB();
      logger.info("Server closed");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Unhandled rejections — log and exit so the process supervisor can restart
  process.on("unhandledRejection", (reason) => {
    logger.error(`Unhandled rejection: ${reason}`);
    shutdown("unhandledRejection");
  });

  return server;
}

start();
