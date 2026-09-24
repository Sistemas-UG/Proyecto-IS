import { Router } from "express";
import { getMyOrganization, createOrganization, updateMyHierarchy, updateMyOrganization } from "../controllers/organizations.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { ROLES } from "../constants/roles.js";

const router = Router();

router.get("/me", requireAuth, getMyOrganization);
router.post("/", requireAuth, requireRole(ROLES.ADMIN), createOrganization);
router.put("/me", requireAuth, requireRole(ROLES.ADMIN), updateMyOrganization);
router.put("/me/jerarquia", requireAuth, requireRole(ROLES.ADMIN), updateMyHierarchy);

export default router;
