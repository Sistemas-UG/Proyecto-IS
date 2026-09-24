import pool from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// GET /api/reports/summary
export const getSummary = asyncHandler(async (req, res) => {
  const orgId = req.user.organizationId;

  const flujosRes = await pool.query(
    `SELECT COUNT(*)::int AS total FROM flujos WHERE organizacion_id = $1`,
    [orgId]
  );
  const cuellosRes = await pool.query(
    `SELECT COUNT(*)::int AS total, AVG(c.tiempo_promedio_horas) AS promedio_horas
     FROM cuellos_de_botella c
     JOIN flujos f ON f.id = c.flujo_id
     WHERE f.organizacion_id = $1`,
    [orgId]
  );
  const { total, promedio_horas } = cuellosRes.rows[0];

  res.json({
    summary: {
      flujosAnalizados: String(flujosRes.rows[0].total),
      tiempoPromedioProceso:
        promedio_horas == null ? "—" : `${(Number(promedio_horas) / 24).toFixed(1)} días`,
      cuellosDeBotella: String(total),
    },
  });
});

// GET /api/reports/bottlenecks
export const getBottlenecks = asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT c.descripcion_paso AS paso,
            f.nombre AS flujo,
            (c.tiempo_promedio_horas::float8)::text || 'h' AS tiempo,
            c.riesgo
     FROM cuellos_de_botella c
     JOIN flujos f ON f.id = c.flujo_id
     WHERE f.organizacion_id = $1
     ORDER BY c.tiempo_promedio_horas DESC`,
    [req.user.organizationId]
  );
  res.json({ bottlenecks: result.rows });
});

// GET /api/reports/insights
// Fase 4: devuelve los reportes de IA YA GUARDADOS (campo CLOB reporteTexto),
// filtrados por la organización del usuario. No vuelve a llamar a la IA:
// esto es "Reportes de la IA guardado" que pedía el catedrático.
export const getInsights = asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT id, flujo_id AS "flujoId", organizacion_id AS "organizationId", titulo,
            reporte_texto AS "reporteTexto", optimizacion, sugerencia,
            ahorro_estimado_horas AS "ahorroEstimadoHoras",
            generated_en AS "generatedEn", generado_por AS "generadoPor"
     FROM insights_ia
     WHERE organizacion_id = $1
     ORDER BY generated_en DESC`,
    [req.user.organizationId]
  );
  res.json({ insights: result.rows });
});

// GET /api/reports/insights/:id
export const getInsightById = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new ApiError(404, "Reporte no encontrado.");

  const result = await pool.query(
    `SELECT id, flujo_id AS "flujoId", organizacion_id AS "organizationId", titulo,
            reporte_texto AS "reporteTexto", optimizacion, sugerencia,
            ahorro_estimado_horas AS "ahorroEstimadoHoras",
            generated_en AS "generatedEn", generado_por AS "generadoPor"
     FROM insights_ia
     WHERE id = $1`,
    [id]
  );
  const insight = result.rows[0];
  if (!insight) throw new ApiError(404, "Reporte no encontrado.");
  if (insight.organizationId !== req.user.organizationId) {
    throw new ApiError(403, "Este reporte no pertenece a tu organización.");
  }
  res.json({ insight });
});
