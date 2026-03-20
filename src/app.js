const fs = require("fs/promises");
const path = require("path");
const express = require("express");
const morgan = require("morgan");
const multer = require("multer");
const { PORT, STORAGE_ROOT } = require("./config");
const fileRoutes = require("./routes/filesRoutes");

async function start() {
  await fs.mkdir(STORAGE_ROOT, { recursive: true });

  const app = express();
  app.use(morgan("dev"));
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: false }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api", fileRoutes);
  app.use(express.static(path.join(__dirname, "..", "public")));

  app.get("*", (_req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "index.html"));
  });

  app.use((error, _req, res, _next) => {
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "Fichier trop volumineux." });
      }
      return res.status(400).json({ error: error.message });
    }

    const statusCode = error.statusCode || 500;
    const message =
      statusCode >= 500 ? "Une erreur interne est survenue." : error.message;
    return res.status(statusCode).json({ error: message });
  });

  app.listen(PORT, () => {
    console.log(`Personal cloud web started on http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error("Failed to start application", error);
  process.exit(1);
});
