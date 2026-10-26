export const MS_POR_DIA = 1000 * 60 * 60 * 24;
export const DIAS_ATENCION = 7; // desde aquí un flujo activo "requiere atención"
export const DIAS_INACTIVO = 30; // desde aquí se considera "inactivo"

const ACTIVITY_KEY = "smartflow_flow_activity";
const STATUS_KEY = "smartflow_flow_status";

// ---------------------------------------------------------------------
// Registro local de última actividad por flujo { [id]: timestamp }
// ---------------------------------------------------------------------
const readActivity = () => {
  try {
    return JSON.parse(localStorage.getItem(ACTIVITY_KEY)) || {};
  } catch {
    return {};
  }
};

// Marca el flujo como "atendido ahora" (abrirlo, revisarlo o cambiar su estado)
export const touchFlow = (id) => {
  if (id === undefined || id === null) return;
  try {
    const map = readActivity();
    map[id] = Date.now();
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(map));
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
};

// ---------------------------------------------------------------------
// Estado elegido por el usuario { [id]: "Activo" | "Completado" }
// Se guarda localmente para que no se pierda si el backend falla.
// ---------------------------------------------------------------------
const readStatus = () => {
  try {
    return JSON.parse(localStorage.getItem(STATUS_KEY)) || {};
  } catch {
    return {};
  }
};

export const setFlowStatus = (id, estado) => {
  if (id === undefined || id === null) return;
  try {
    const map = readStatus();
    map[id] = estado;
    localStorage.setItem(STATUS_KEY, JSON.stringify(map));
  } catch {
    /* noop */
  }
};

// Aplica los estados guardados localmente sobre la lista que llega del backend
export const applyStatusOverrides = (flows) => {
  const map = readStatus();
  return flows.map((f) => (map[f.id] ? { ...f, estado: map[f.id] } : f));
};

// Limpia el registro de un flujo eliminado (actividad + estado)
export const forgetFlow = (id) => {
  try {
    const activity = readActivity();
    delete activity[id];
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activity));

    const status = readStatus();
    delete status[id];
    localStorage.setItem(STATUS_KEY, JSON.stringify(status));
  } catch {
    /* noop */
  }
};

// ---------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------
// Soporta ISO, YYYY-MM-DD y DD/MM/YYYY
export const parseDateToMs = (dateStr) => {
  if (!dateStr) return 0;
  if (typeof dateStr === "number") return dateStr;

  let parsed = new Date(dateStr).getTime();
  if (!isNaN(parsed) && parsed > 0) return parsed;

  if (typeof dateStr === "string" && dateStr.includes("/")) {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const iso = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
      parsed = new Date(iso).getTime();
      if (!isNaN(parsed)) return parsed;
    }
  }
  return 0;
};

// ---------------------------------------------------------------------
// Normalización (misma para Dashboard y Mis Flujos)
// ---------------------------------------------------------------------
export const normalizeFlow = (f) => {
  const rawDate = f.fecha || f.created_at || f.createdAt;
  const timestamp = parseDateToMs(rawDate);

  let formattedDate = "Reciente";
  if (timestamp > 0) {
    formattedDate = new Date(timestamp).toISOString().split("T")[0];
  } else if (typeof rawDate === "string" && rawDate.trim()) {
    formattedDate = rawDate;
  }

  let stepsData = f.pasos || f.nodes || f.steps || f.diagrama?.nodes || f.pasos_json || [];
  if (typeof stepsData === "string") {
    try {
      stepsData = JSON.parse(stepsData);
    } catch (e) {
      stepsData = [];
    }
  }
  if (!Array.isArray(stepsData) && typeof stepsData === "object" && stepsData !== null) {
    stepsData = stepsData.nodes || stepsData.pasos || stepsData.steps || [];
  }

  const totalPasos = Array.isArray(stepsData)
    ? stepsData.length
    : typeof f.pasos === "number"
    ? f.pasos
    : 0;

  return {
    id: f.id || f.id_flujo || f._id,
    nombre: f.nombre || f.title || f.name || "Flujo sin nombre",
    fecha: formattedDate,
    rawTimestamp: timestamp,
    pasos: totalPasos,
    estado: f.estado || f.status || "Activo",
    insight: f.insight || f.diagrama?.insight,
    ahorro_estimado_horas: f.ahorro_estimado_horas,
  };
};

// ---------------------------------------------------------------------
// Estado efectivo según días sin actividad
// Agrega: diasSinActividad, estadoLabel, estadoTone
// (el campo "estado" original NO se modifica)
// ---------------------------------------------------------------------
export const enrichFlows = (flows) => {
  const ahora = Date.now();
  const activity = readActivity();

  return flows.map((f) => {
    const ultima = Math.max(f.rawTimestamp || 0, activity[f.id] || 0);
    const dias = ultima > 0 ? Math.max(0, Math.floor((ahora - ultima) / MS_POR_DIA)) : 0;

    let estadoLabel = f.estado;
    let estadoTone = "amber";

    if (f.estado === "Completado") {
      estadoTone = "blue";
    } else if (f.estado === "Activo") {
      if (dias >= DIAS_INACTIVO) {
        estadoLabel = "Inactivo";
        estadoTone = "gray";
      } else if (dias >= DIAS_ATENCION) {
        estadoLabel = "Requiere atención";
        estadoTone = "amber";
      } else {
        estadoTone = "green";
      }
    }

    return { ...f, diasSinActividad: dias, estadoLabel, estadoTone };
  });
};

// ---------------------------------------------------------------------
// Flujos que necesitan atención (recibe flujos ya enriquecidos)
// Solo Activos con DIAS_ATENCION+ días sin movimiento, por prioridad
// ---------------------------------------------------------------------
export const getFlujosAtencion = (enrichedFlows, limit = 3) =>
  enrichedFlows
    .filter((f) => f.estado === "Activo" && f.diasSinActividad >= DIAS_ATENCION)
    .map((f) => ({
      ...f,
      prioridad: f.diasSinActividad + (f.pasos || 0) * 0.5 + (f.insight ? 5 : 0),
    }))
    .sort((a, b) => b.prioridad - a.prioridad)
    .slice(0, limit);