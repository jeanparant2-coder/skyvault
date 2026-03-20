const path = require("path");
const { STORAGE_ROOT } = require("../config");

function buildHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeRelativePath(input = "") {
  const raw = String(input || "").trim().replaceAll("\\", "/");
  if (!raw || raw === "/" || raw === ".") {
    return "";
  }

  const base = raw.startsWith("/") ? raw.slice(1) : raw;
  const normalized = path.posix.normalize(base);

  if (!normalized || normalized === "." || normalized === "/") {
    return "";
  }

  return normalized;
}

function resolveSafePath(relativePath = "") {
  const normalized = normalizeRelativePath(relativePath);
  const absolute = path.resolve(STORAGE_ROOT, normalized);
  const relativeFromRoot = path.relative(STORAGE_ROOT, absolute);
  const escapedRoot =
    relativeFromRoot.startsWith("..") || path.isAbsolute(relativeFromRoot);

  if (escapedRoot) {
    throw buildHttpError("Chemin invalide.", 400);
  }

  return {
    normalized,
    absolute,
  };
}

function validateItemName(name) {
  const value = String(name || "").trim();
  if (!value) {
    throw buildHttpError("Le nom est requis.", 400);
  }

  if (value === "." || value === "..") {
    throw buildHttpError("Nom non autorise.", 400);
  }

  if (/[\\/]/.test(value)) {
    throw buildHttpError("Le nom ne doit pas contenir de slash.", 400);
  }

  if (/[<>:"|?*\u0000-\u001F]/.test(value)) {
    throw buildHttpError("Le nom contient des caracteres invalides.", 400);
  }

  return value;
}

function joinRelativePath(basePath, name) {
  const normalizedBase = normalizeRelativePath(basePath);
  return normalizeRelativePath(path.posix.join(normalizedBase, name));
}

function toDisplayPath(normalizedPath) {
  if (!normalizedPath) {
    return "/";
  }

  return `/${normalizedPath}`;
}

module.exports = {
  buildHttpError,
  normalizeRelativePath,
  resolveSafePath,
  validateItemName,
  joinRelativePath,
  toDisplayPath,
};
