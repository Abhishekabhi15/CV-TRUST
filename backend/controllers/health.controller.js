/**
 * Health check controller.
 * GET /api/health — fully implemented.
 * Reports server uptime and dependency status (MongoDB, Python service).
 */
const mongoose = require('mongoose');
const axios = require('axios');
const http = require('http');
const https = require('https');
const config = require('../config');

const getHealth = async (req, res) => {
  const health = {
    status: 'OK',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    services: {
      mongodb: 'down',
      pythonService: 'down',
    },
  };

  // Check MongoDB connection
  try {
    if (mongoose.connection.readyState === 1) {
      health.services.mongodb = 'up';
    }
  } catch {
    health.services.mongodb = 'down';
  }

  // Check Python/YOLO service
  try {
    await axios.get(`${config.pythonServiceUrl}/health`, {
      timeout: 1000,
      httpAgent: new http.Agent({ keepAlive: false }),
      httpsAgent: new https.Agent({ keepAlive: false }),
      proxy: false,
    });
    health.services.pythonService = 'up';
  } catch {
    health.services.pythonService = 'down';
  }

  // Determine overall status
  const statuses = Object.values(health.services);
  const upCount = statuses.filter((s) => s === 'up').length;
  if (upCount === statuses.length) {
    health.status = 'OK';
  } else if (upCount > 0) {
    health.status = 'PARTIAL';
  } else {
    health.status = 'DEGRADED';
  }

  res.json({
    success: true,
    message: 'CV-TRUST backend is running',
    status: health.status,
    data: health,
    meta: { timestamp: health.timestamp },
  });
};

module.exports = { getHealth };
