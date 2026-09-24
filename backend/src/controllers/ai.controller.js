import { generateFlowFromDescription, generateReportFromFlow } from "../services/ai.service.js";
import pool from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// POST /api/ai/generate-flow
// Fase 3: se busca la jerarquía Y el sector/industria de la organización del
// usuario logueado y se le pasan al servicio de IA, para que el flujo
// generado sea específico a esa empresa (no un organigrama genérico ni un
// vocabulario de un sector distinto al suyo). Si el admin pide explícitamente
// un flujo "general" (body.general === true), se ignora ese contexto a propósito.
export const generateFlow = asyncHandler(async (req, res) => {
  const { descripcion, general = false } = req.body;

  if (!descripcion || !descripcion.trim()) {
    throw new ApiError(400, "El campo 'descripcion' es requerido.");
  }

  let jerarquia = [];
  let tipoIndustria = "";
  if (!general) {
    const orgRes = await pool.query(
      `SELECT tipo_industria, jerarquia FROM organizaciones WHERE id = $1`,
      [req.user.organizationId]
    );
    const org = orgRes.rows[0];
    jerarquia = org?.jerarquia || [];
    tipoIndustria = org?.tipo_industria || "";
  }

  const result = await generateFlowFromDescription(descripcion, jerarquia, tipoIndustria);
  res.json(result);
});

// POST /api/ai/generate-report
// Fase 4: además de devolver el reporte, lo persiste en Insights_IA
// (reporteTexto = CLOB) asociado al flujo, para no tener que regenerarlo
// cada vez que alguien lo consulta.
export const generateReport = asyncHandler(async (req, res) => {
  const flowData = req.body; // { flujoId, nombre, nodes, edges, insight, format }

  if (!flowData.nodes || !flowData.nodes.length) {
    throw new ApiError(400, "Se requieren los nodos del flujo para generar el reporte.");
  }

  const report = await generateReportFromFlow(flowData);

  // El flujoId solo se guarda si es un flujo real de esta organización
  let flujoId = null;
  const candidato = Number(flowData.flujoId);
  if (Number.isInteger(candidato) && candidato > 0) {
    const flujoRes = await pool.query(
      `SELECT id FROM flujos WHERE id = $1 AND organizacion_id = $2`,
      [candidato, req.user.organizationId]
    );
    if (flujoRes.rows.length > 0) flujoId = candidato;
  }

  // La columna es INTEGER: si la IA devuelve decimales hay que redondear
  const ahorroRaw = flowData.insight?.ahorro_estimado_horas;
  const ahorro = ahorroRaw == null ? null : Math.round(Number(ahorroRaw));

  const insertRes = await pool.query(
    `INSERT INTO insights_ia
       (flujo_id, organizacion_id, generado_por, titulo, reporte_texto,
        optimizacion, sugerencia, ahorro_estimado_horas)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      flujoId,
      req.user.organizationId,
      req.user.id,
      String(report.titulo).slice(0, 255),
      report.contenido,
      flowData.insight?.optimizacion || null,
      flowData.insight?.sugerencia || null,
      Number.isFinite(ahorro) ? ahorro : null,
    ]
  );

  res.json({ ...report, insightId: insertRes.rows[0].id });
});