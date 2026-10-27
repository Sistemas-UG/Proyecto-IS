export const MS_POR_DIA = 1000 * 60 * 60 * 24;
export const DIAS_ATENCION = 7;
export const DIAS_INACTIVO = 30;

const ACTIVITY_KEY = "smartflow_flow_activity";
const STATUS_KEY = "smartflow_flow_status";

const readActivity = () => {
  try {
    return JSON.parse(localStorage.getItem(ACTIVITY_KEY)) || {};
  } catch {
    return {};
  }
};

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

export const applyStatusOverrides = (flows) => {
  const map = readStatus();
  return flows.map((f) => (map[f.id] ? { ...f, estado: map[f.id] } : f));
};

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
// Rol embebido en el label de un paso: "Texto del paso (Rol)"
// ---------------------------------------------------------------------
const ROLE_RE = /^(.*?)\s*\(([^()]+)\)\s*$/;
const extraerRol = (label = "") => {
  const m = String(label).match(ROLE_RE);
  return m ? m[2].trim() : "";
};

// ---------------------------------------------------------------------
// Algoritmo de ahorro estimado (horas)
// Se usa como respaldo cuando el flujo no trae un ahorro calculado por la
// IA (flow.aiInsight / flow.insight). Se basa en la estructura del propio
// flujo: cada paso automatizado ahorra ~21 min de trabajo manual, cada
// decisión que antes se revisaba a mano ahorraba ~30 min, y cada rol
// distinto involucrado representa ~45 min de coordinación/handoff que ya
// no hace falta. Es el MISMO algoritmo en Mis Flujos, Ver Flujo y el
// Dashboard, así el total del Dashboard siempre cuadra con el detalle de
// cada flujo individual.
export const calcularAhorroEstimado = (pasos = 0, decisiones = 0, roles = 0) => {
  if (!pasos) return 0;
  const horas = pasos * 0.35 + decisiones * 0.5 + roles * 0.75;
  return Math.max(0.5, Math.round(horas * 10) / 10);
};

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

  // Decisiones y roles distintos, a partir de los nodos reales (cuando
  // vienen completos y no solo como número), para alimentar el algoritmo
  // de ahorro estimado de arriba.
  let totalDecisiones = 0;
  let totalRoles = 0;
  if (Array.isArray(stepsData) && stepsData.length && typeof stepsData[0] === "object") {
    totalDecisiones = stepsData.filter(
      (n) => (n.type || n.tipo || n.data?.tipo) === "decision"
    ).length;
    const roles = new Set(
      stepsData.map((n) => extraerRol(n.label || n.data?.label || n.texto || "")).filter(Boolean)
    );
    totalRoles = roles.size;
  }

  return {
    id: f.id || f.id_flujo || f._id,
    nombre: f.nombre || f.title || f.name || "Flujo sin nombre",
    fecha: formattedDate,
    rawTimestamp: timestamp,
    pasos: totalPasos,
    decisiones: totalDecisiones,
    roles: totalRoles,
    estado: f.estado || f.status || "Activo",
    insight: f.insight || f.diagrama?.insight,
    ahorro_estimado_horas: f.ahorro_estimado_horas,
  };
};

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

    return { ...f, ultimaActividad: ultima, diasSinActividad: dias, estadoLabel, estadoTone };
  });
};

export const getFlujosAtencion = (enrichedFlows, limit = 3) =>
  enrichedFlows
    .filter((f) => f.estado === "Activo")
    .sort((a, b) => {
      if (a.ultimaActividad !== b.ultimaActividad) return a.ultimaActividad - b.ultimaActividad;
      return (b.pasos || 0) - (a.pasos || 0);
    })
    .slice(0, limit);