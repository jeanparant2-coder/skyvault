const path = require("path");

/**
 * PORT :
 * - process.env.PORT = variable d’environnement (ex: Docker)
 * - 8080 = port par défaut si rien n’est défini
 */
const PORT = Number(process.env.PORT) || 8080;

/**
 * STORAGE_ROOT :
 * - Dossier où sont stockés les fichiers upload
 * - Ici : /data/storage à la racine du projet
 */
const STORAGE_ROOT = path.join(__dirname, "..", "data", "storage");

module.exports = {
  PORT,
  STORAGE_ROOT,
};
