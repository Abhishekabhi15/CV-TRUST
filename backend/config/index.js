/**
 * CV-TRUST Backend Configuration
 * Loads environment variables with sensible defaults for local development.
 */

require("dotenv").config();

module.exports = {
  // Render provides PORT automatically in production.
  port: parseInt(process.env.PORT, 10) || 3000,

  nodeEnv: process.env.NODE_ENV || "development",

  // Local MongoDB fallback for development.
  mongodbUri: process.env.MONGODB_URI || "mongodb://localhost:27017/cvtrust",

  // Local Python YOLO fallback for development.
  pythonServiceUrl: process.env.PYTHON_SERVICE_URL || "http://localhost:5000",

  pythonServiceTimeout:
    parseInt(process.env.PYTHON_SERVICE_TIMEOUT, 10) || 90000,  // 90s default for Render free CPU

  // Can be set to the deployed frontend URL on Render.
  corsOrigin: process.env.CORS_ORIGIN || "*",

  logLevel: process.env.LOG_LEVEL || "debug",

  // Local fallback. We will handle production upload storage separately.
  uploadDir: process.env.UPLOAD_DIR || "./uploads",

  maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 50 * 1024 * 1024, // 50 MB
};
