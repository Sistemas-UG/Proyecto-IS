import { Router } from "express";
import { 
  login, 
  register, 
  me, 
  forgotPassword, 
  resetPassword 
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/login", login);
router.post("/register", register);
router.get("/me", requireAuth, me);

// Rutas de recuperación de contraseña
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;