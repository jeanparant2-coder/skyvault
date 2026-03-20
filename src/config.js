const path = require("path");

const PORT = Number(process.env.PORT) || 8080;
const STORAGE_ROOT = path.join(__dirname, "..", "data", "storage");

module.exports = {
  PORT,
  STORAGE_ROOT,
};
