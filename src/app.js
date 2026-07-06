const express = require("express");
const logger = require("./logger");

const app = express();
const port = process.env.PORT || 3000;
const version = process.env.APP_VERSION || "1.0.0";

app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
    });
  });
  next();
});

app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>CI/CD DevOps App</title>
      <style>
        body {
          margin: 0;
          font-family: Arial, sans-serif;
          background: linear-gradient(135deg, #0f2027, #203a43, #2c5364);
          color: white;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
        }
        .container {
          text-align: center;
          padding: 40px;
          border-radius: 15px;
          background: rgba(0,0,0,0.4);
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        h1 { font-size: 2.5rem; margin-bottom: 10px; }
        p { font-size: 1.2rem; opacity: 0.8; }
        .badge {
          margin-top: 20px;
          display: inline-block;
          padding: 10px 20px;
          border-radius: 20px;
          background: #00c9ff;
          color: black;
          font-weight: bold;
        }
        .info { margin-top: 30px; font-size: 0.9rem; opacity: 0.6; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>CI/CD Pipeline Live</h1>
        <p>Docker + GitHub Actions + Node.js</p>
        <div class="badge">Build Successful</div>
        <div class="info">Version: ${version}</div>
      </div>
    </body>
    </html>
  `);
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    version,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get("/version", (req, res) => {
  res.json({
    version,
    name: "ci-cd_nodeapp",
    description: "Enterprise CI/CD Pipeline Demonstration",
  });
});

app.use((err, req, res, next) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({
    status: "error",
    message: "Internal server error",
  });
});

const server = app.listen(port, () => {
  logger.info(`Server running on port ${port} (version: ${version})`);
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});

module.exports = app;
