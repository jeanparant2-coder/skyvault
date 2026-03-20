const fs = require("fs/promises");
const path = require("path");
const { STORAGE_CAPACITY_BYTES, STORAGE_ROOT } = require("../config");
const {
  buildHttpError,
  joinRelativePath,
  normalizeRelativePath,
  resolveSafePath,
  toDisplayPath,
  validateItemName,
} = require("../utils/pathUtils");

async function ensureStorageRoot() {
  await fs.mkdir(STORAGE_ROOT, { recursive: true });
}

function sortItems(items) {
  return items.sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === "folder" ? -1 : 1;
    }

    return left.name.localeCompare(right.name, "fr", { sensitivity: "base" });
  });
}

async function computeDirectorySize(dirPath) {
  let total = 0;

  async function walk(currentPath) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const absoluteEntryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await walk(absoluteEntryPath);
      } else if (entry.isFile()) {
        const stats = await fs.stat(absoluteEntryPath);
        total += stats.size;
      }
    }
  }

  await walk(dirPath);
  return total;
}

function toItemPayload(relativePath, stats) {
  const normalized = normalizeRelativePath(relativePath);

  return {
    name: path.basename(stats.absolutePath),
    relativePath: normalized,
    path: toDisplayPath(normalized),
    type: stats.isDirectory ? "folder" : "file",
    size: stats.isDirectory ? null : stats.size,
    updatedAt: stats.updatedAt,
  };
}

async function getItem(relativePath) {
  const { absolute, normalized } = resolveSafePath(relativePath);
  const stats = await fs.stat(absolute);

  return toItemPayload(normalized, {
    absolutePath: absolute,
    isDirectory: stats.isDirectory(),
    size: stats.size,
    updatedAt: stats.mtime.toISOString(),
  });
}

async function listChildren(relativePath) {
  const { absolute, normalized } = resolveSafePath(relativePath);
  await fs.mkdir(absolute, { recursive: true });

  const entries = await fs.readdir(absolute, { withFileTypes: true });
  const items = [];

  for (const entry of entries) {
    const itemRelativePath = joinRelativePath(normalized, entry.name);
    const absoluteItemPath = path.join(absolute, entry.name);
    const entryStats = await fs.stat(absoluteItemPath);

    items.push(
      toItemPayload(itemRelativePath, {
        absolutePath: absoluteItemPath,
        isDirectory: entry.isDirectory(),
        size: entryStats.size,
        updatedAt: entryStats.mtime.toISOString(),
      })
    );
  }

  return sortItems(items);
}

async function searchItems(relativePath, searchTerm) {
  const { absolute, normalized } = resolveSafePath(relativePath);
  await fs.mkdir(absolute, { recursive: true });
  const needle = String(searchTerm || "").trim().toLowerCase();
  if (!needle) {
    return listChildren(normalized);
  }

  const items = [];

  async function walk(currentAbsolutePath, currentRelativePath) {
    const entries = await fs.readdir(currentAbsolutePath, { withFileTypes: true });

    for (const entry of entries) {
      const absoluteItemPath = path.join(currentAbsolutePath, entry.name);
      const itemRelativePath = joinRelativePath(currentRelativePath, entry.name);
      const entryStats = await fs.stat(absoluteItemPath);

      if (entry.name.toLowerCase().includes(needle)) {
        items.push(
          toItemPayload(itemRelativePath, {
            absolutePath: absoluteItemPath,
            isDirectory: entry.isDirectory(),
            size: entryStats.size,
            updatedAt: entryStats.mtime.toISOString(),
          })
        );
      }

      if (entry.isDirectory()) {
        await walk(absoluteItemPath, itemRelativePath);
      }
    }
  }

  await walk(absolute, normalized);
  return sortItems(items);
}

async function getStorageStats() {
  const usedBytes = await computeDirectorySize(STORAGE_ROOT);
  const usagePercent = Math.min(
    100,
    Math.round((usedBytes / STORAGE_CAPACITY_BYTES) * 10000) / 100
  );

  return {
    usedBytes,
    totalBytes: STORAGE_CAPACITY_BYTES,
    usagePercent,
  };
}

async function listItems(relativePath, search) {
  await ensureStorageRoot();
  const normalizedPath = normalizeRelativePath(relativePath);
  const query = String(search || "").trim();
  const items = query
    ? await searchItems(normalizedPath, query)
    : await listChildren(normalizedPath);
  const stats = await getStorageStats();

  return {
    currentPath: normalizedPath,
    displayPath: toDisplayPath(normalizedPath),
    search: query,
    items,
    stats,
  };
}

async function createFolder(relativePath, name) {
  await ensureStorageRoot();

  const folderName = validateItemName(name);
  const { absolute: parentAbsolutePath, normalized: parentRelativePath } =
    resolveSafePath(relativePath);
  await fs.mkdir(parentAbsolutePath, { recursive: true });

  const folderRelativePath = joinRelativePath(parentRelativePath, folderName);
  const { absolute: folderAbsolutePath } = resolveSafePath(folderRelativePath);

  try {
    await fs.mkdir(folderAbsolutePath, { recursive: false });
  } catch (error) {
    if (error && error.code === "EEXIST") {
      throw buildHttpError("Un element avec ce nom existe deja.", 409);
    }
    throw error;
  }

  return getItem(folderRelativePath);
}

function splitName(filename) {
  const extension = path.extname(filename);
  const nameWithoutExtension = extension
    ? filename.slice(0, -extension.length)
    : filename;

  return {
    basename: nameWithoutExtension || "fichier",
    extension,
  };
}

async function ensureUniqueFileName(targetDirectoryAbsolutePath, requestedName) {
  const { basename, extension } = splitName(requestedName);
  let candidate = `${basename}${extension}`;
  let index = 1;

  for (;;) {
    const candidatePath = path.join(targetDirectoryAbsolutePath, candidate);
    try {
      await fs.access(candidatePath);
      candidate = `${basename} (${index})${extension}`;
      index += 1;
    } catch {
      return candidate;
    }
  }
}

async function uploadFiles(relativePath, files) {
  await ensureStorageRoot();

  if (!Array.isArray(files) || files.length === 0) {
    throw buildHttpError("Aucun fichier a envoyer.", 400);
  }

  const { absolute: targetDirectoryAbsolutePath, normalized: targetRelativePath } =
    resolveSafePath(relativePath);
  await fs.mkdir(targetDirectoryAbsolutePath, { recursive: true });

  const uploadedItems = [];

  for (const file of files) {
    const originalName = validateItemName(file.originalname || "fichier");
    const uniqueName = await ensureUniqueFileName(
      targetDirectoryAbsolutePath,
      originalName
    );
    const destinationAbsolutePath = path.join(
      targetDirectoryAbsolutePath,
      uniqueName
    );

    await fs.writeFile(destinationAbsolutePath, file.buffer);
    uploadedItems.push(await getItem(joinRelativePath(targetRelativePath, uniqueName)));
  }

  return uploadedItems;
}

async function renameItem(relativePath, newName) {
  await ensureStorageRoot();
  const sourceRelativePath = normalizeRelativePath(relativePath);
  if (!sourceRelativePath) {
    throw buildHttpError("La racine ne peut pas etre renommee.", 400);
  }

  const source = resolveSafePath(sourceRelativePath);
  const sanitizedName = validateItemName(newName);

  try {
    await fs.access(source.absolute);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw buildHttpError("Element introuvable.", 404);
    }
    throw error;
  }

  const parentRelativePath = normalizeRelativePath(
    path.posix.dirname(sourceRelativePath)
  );
  const targetRelativePath = joinRelativePath(
    parentRelativePath === "." ? "" : parentRelativePath,
    sanitizedName
  );
  const target = resolveSafePath(targetRelativePath);

  if (source.absolute === target.absolute) {
    return getItem(sourceRelativePath);
  }

  try {
    await fs.access(target.absolute);
    throw buildHttpError("Un element avec ce nom existe deja.", 409);
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      throw error;
    }
  }

  await fs.rename(source.absolute, target.absolute);
  return getItem(targetRelativePath);
}

async function deleteItem(relativePath) {
  await ensureStorageRoot();
  const normalized = normalizeRelativePath(relativePath);
  if (!normalized) {
    throw buildHttpError("La racine ne peut pas etre supprimee.", 400);
  }

  const { absolute } = resolveSafePath(normalized);
  try {
    await fs.rm(absolute, { recursive: true, force: false });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw buildHttpError("Element introuvable.", 404);
    }
    throw error;
  }
}

module.exports = {
  listItems,
  createFolder,
  uploadFiles,
  renameItem,
  deleteItem,
};
