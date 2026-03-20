const express = require("express");
const multer = require("multer");
const { MAX_UPLOAD_SIZE_MB } = require("../config");
const storageService = require("../services/storageService");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 20,
    fileSize: MAX_UPLOAD_SIZE_MB * 1024 * 1024,
  },
});

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

router.get(
  "/items",
  asyncHandler(async (req, res) => {
    const payload = await storageService.listItems(req.query.path, req.query.search);
    res.json(payload);
  })
);

router.post(
  "/folders",
  asyncHandler(async (req, res) => {
    const item = await storageService.createFolder(req.body.path, req.body.name);
    res.status(201).json({ item });
  })
);

router.post(
  "/upload",
  upload.array("files", 20),
  asyncHandler(async (req, res) => {
    const items = await storageService.uploadFiles(req.body.path, req.files);
    res.status(201).json({ items });
  })
);

router.patch(
  "/items",
  asyncHandler(async (req, res) => {
    const item = await storageService.renameItem(req.body.path, req.body.newName);
    res.json({ item });
  })
);

router.delete(
  "/items",
  asyncHandler(async (req, res) => {
    await storageService.deleteItem(req.query.path);
    res.status(204).send();
  })
);

module.exports = router;
