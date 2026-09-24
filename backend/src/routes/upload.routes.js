import express from "express";
import multer from "multer";
import { uploadBufferToGCS } from "../services/storageService.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

router.post("/", requireAuth, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No se envió ningún archivo." });
    }

    const cleanFileName = req.file.originalname.replace(/\s+/g, "_");
    const destinationPath = `adjuntos/${Date.now()}-${cleanFileName}`;

    const uploadResult = await uploadBufferToGCS(
      req.file.buffer,
      destinationPath,
      req.file.mimetype
    );

    return res.status(200).json({
      message: "Archivo subido exitosamente",
      file: uploadResult,
    });
  } catch (error) {
    next(error);
  }
});

export default router;