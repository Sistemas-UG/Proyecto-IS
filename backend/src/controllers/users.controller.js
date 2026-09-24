import pool from "../config/db.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// GET /api/users  (equipo, para la pantalla de Configuración)
export const listUsers = asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT id, nombre AS name, email, rol AS role
     FROM usuarios
     WHERE organizacion_id = $1
     ORDER BY id`,
    [req.user.organizationId]
  );
  res.json({ users: result.rows });
});
