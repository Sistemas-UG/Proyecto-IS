import pool from "../config/db.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// GET /api/dashboard/kpis
export const getKpis = asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT flujos_activos, flujos_totales, horas_ahorradas_totales, score_optimizacion_promedio
     FROM org_kpis
     WHERE organizacion_id = $1`,
    [req.user.organizationId]
  );
  const k = result.rows[0] || {};

  res.json({
    kpis: {
      flujosActivos: {
        value: String(k.flujos_activos ?? 0),
        delta: `${k.flujos_totales ?? 0} flujos en total`,
      },
      tiempoAhorrado: {
        value: `${k.horas_ahorradas_totales ?? 0}h`,
        delta: "según reportes de IA",
      },
      scoreOptimizacion: {
        value: String(k.score_optimizacion_promedio ?? 0),
        delta: "promedio de los reportes de IA",
      },
    },
  });
});

// GET /api/dashboard/recent-flows
// Igual que en flows.controller: solo los flujos de la organización del usuario.
export const getRecentFlows = asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT id, nombre, estado, tipo, pasos,
            propietario_id AS "ownerId",
            organizacion_id AS "organizationId",
            to_char(creado_en, 'DD/MM/YYYY') AS "fecha"
     FROM flujos
     WHERE organizacion_id = $1
     ORDER BY creado_en DESC
     LIMIT 5`,
    [req.user.organizationId]
  );
  res.json({ flows: result.rows });
});
