import { Router } from "express";
import { generateFlow, generateReport } from "../controllers/ai.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { ROLES } from "../constants/roles.js";

const router = Router();

// Solo el admin genera flujos y reportes con IA; el usuario normal solo consulta
// lo ya guardado (ver GET /api/reports).
router.post("/generate-flow", requireAuth, requireRole(ROLES.ADMIN), generateFlow);
router.post("/generate-report", requireAuth, requireRole(ROLES.ADMIN), generateReport);

export default router;