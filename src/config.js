const path = require("path");

const PORT = Number(process.env.PORT) || 8080;
const STORAGE_ROOT = path.resolve(
  process.env.STORAGE_ROOT || path.join(process.cwd(), "data", "storage")
);
const MAX_UPLOAD_SIZE_MB = Number(process.env.MAX_UPLOAD_SIZE_MB || 200);
const STORAGE_CAPACITY_BYTES = Number(
  process.env.STORAGE_CAPACITY_BYTES || 20 * 1024 * 1024 * 1024
);

module.exports = {
  PORT,
  STORAGE_ROOT,
  MAX_UPLOAD_SIZE_MB,
  STORAGE_CAPACITY_BYTES,
};