import pool from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// GET /api/organizations/me
// Devuelve la organización del usuario logueado (admin o usuario normal).
export const getMyOrganization = asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT id, nombre, tipo_industria, jerarquia FROM organizaciones WHERE id = $1`,
    [req.user.organizationId]
  );
  if (result.rows.length === 0) throw new ApiError(404, "Organización no encontrada.");
  res.json({ organization: result.rows[0] });
});

// POST /api/organizations  (solo admin, vía requireRole en la ruta)
// Crea una organización nueva con su jerarquía. Esa jerarquía es la que luego
// se le pasa a Vertex AI como contexto para generar flujos específicos (Fase 3).
export const createOrganization = asyncHandler(async (req, res) => {
  const { nombre, tipo_industria = "General", jerarquia = [] } = req.body;

  if (!nombre) throw new ApiError(400, "El campo 'nombre' es requerido.");
  if (!Array.isArray(jerarquia) || jerarquia.length === 0) {
    throw new ApiError(400, "'jerarquia' debe ser un arreglo con al menos un nivel (ej: ['Empleado','Gerencia']).");
  }

  const result = await pool.query(
    `INSERT INTO organizaciones (nombre, tipo_industria, jerarquia)
     VALUES ($1, $2, $3)
     RETURNING id, nombre, tipo_industria, jerarquia`,
    [nombre, tipo_industria, jerarquia.map((s) => String(s).trim()).filter(Boolean)]
  );
  res.status(201).json({ organization: result.rows[0] });
});

// PUT /api/organizations/me/jerarquia  (solo admin)
// Permite ajustar la jerarquía de la propia organización sin crear una nueva.
export const updateMyHierarchy = asyncHandler(async (req, res) => {
  const { jerarquia } = req.body;
  if (!Array.isArray(jerarquia) || jerarquia.length === 0) {
    throw new ApiError(400, "'jerarquia' debe ser un arreglo con al menos un nivel.");
  }

    const result = await pool.query(
    `UPDATE organizaciones SET jerarquia = $1 WHERE id = $2
     RETURNING id, nombre, tipo_industria, jerarquia`,
    [jerarquia.map((s) => String(s).trim()).filter(Boolean), req.user.organizationId]
  );
  if (result.rows.length === 0) throw new ApiError(404, "Organización no encontrada.");
  res.json({ organization: result.rows[0] });
});

// PUT /api/organizations/me  (solo admin)
// Actualiza el perfil de la propia organización: su sector/industria y/o su
// jerarquía de roles. Ambos datos son el contexto que luego se le pasa a la
// IA (ver ai.controller.js) para que los flujos generados encajen con ESTA
// empresa en particular, en vez de asumir una estructura o sector genéricos.
// Los campos son parciales: solo se actualiza lo que venga en el body.
export const updateMyOrganization = asyncHandler(async (req, res) => {
  const { nombre, tipo_industria, jerarquia } = req.body;

    let nuevaJerarquia = null;
  if (jerarquia !== undefined) {
    if (!Array.isArray(jerarquia) || jerarquia.length === 0) {
      throw new ApiError(400, "'jerarquia' debe ser un arreglo con al menos un nivel.");
    }
    nuevaJerarquia = jerarquia.map((s) => String(s).trim()).filter(Boolean);
  }
  const nuevoNombre = typeof nombre === "string" && nombre.trim() ? nombre.trim() : null;
  const nuevaIndustria =
    typeof tipo_industria === "string" && tipo_industria.trim() ? tipo_industria.trim() : null;

  const result = await pool.query(
    `UPDATE organizaciones
     SET nombre         = COALESCE($1::varchar, nombre),
         tipo_industria = COALESCE($2::varchar, tipo_industria),
         jerarquia      = COALESCE($3::text[], jerarquia)
     WHERE id = $4
     RETURNING id, nombre, tipo_industria, jerarquia`,
    [nuevoNombre, nuevaIndustria, nuevaJerarquia, req.user.organizationId]
  );
  if (result.rows.length === 0) throw new ApiError(404, "Organización no encontrada.");
  res.json({ organization: result.rows[0] });
});
