// Nivel 1 del documento de arquitectura: "Usuario describe proceso → Gemini → Genera workflow".
// Si hay un proyecto de GCP configurado (.env), llama a Vertex AI + Gemini de verdad.
// Si no, cae al generador simulado para poder seguir desarrollando sin gastar cuota.
//
// Flujo de datos: React → POST /api/ai/generate-flow → este archivo → Vertex AI → Gemini → JSON → React

import { GoogleGenAI } from "@google/genai";
import { env, isVertexConfigured } from "../config/env.js";

// Prompt base optimizado profesionalmente para BPM sin restricciones arbitrarias de nodos.
const BASE_PROMPT = `Actúas como Consultor Senior de Procesos de Negocio (BPM) y Arquitecto de Process Mining de nivel empresarial.

Tu objetivo es analizar minuciosamente la descripción del proceso proporcionada por el usuario y transformarla en un diagrama de flujo de trabajo (workflow) exhaustivo, preciso, ejecutable y adaptado a la escala real de esa organización.

REGLAS STRICTAS DE MODELADO Y ARQUITECTURA:

1. Escala y Granularidad Dinámica (SIN LÍMITES ARBITRARIOS DE NODOS):
   - NO limites ni restrinja la cantidad de nodos. Modela el proceso con tantos pasos como sean necesarios según la descripción del usuario.
   - Procesos simples requerirán pocos nodos; procesos complejos de nivel corporativo requerirán múltiples nodos, bifurcaciones y estados de cierre.
   - Captura la secuencia completa: detonante inicial, tareas operativas, registros en sistemas, validaciones, aprobaciones, notificaciones y todos los posibles finales.

2. Tipología y Estructura Formal de Nodos:
   - "id": Identificador único en formato string numérico secuencial ("1", "2", "3"...).
   - "type": Asigna estrictamente uno de los siguientes 4 tipos:
     * "inicio": Punto de entrada o desencadenante del proceso (debe existir exactamente 1).
     * "paso": Acción operativa, tarea manual, cálculo, consulta o actualización en sistema.
     * "decision": Punto condicional de validación, aprobación o evaluación de regla de negocio.
     * "fin": Estado final alcanzado (éxito, rechazo, cancelación, timeout, etc.).
   - Regla estricta para "decision": Cada nodo de tipo "decision" DEBE tener obligatoriamente exactamente DOS conexiones (edges) salientes: una con label "Sí" y otra con label "No", apuntando a sus respectivos flujos.

3. Evaluación de Cuellos de Botella (Bottlenecks) e Insights:
   - Identifica con criterio experto los puntos propensos a burocracia, demoras o errores humanos.
   - El campo "paso" en "bottlenecks" DEBE ser una coincidencia exacta con el "label" de un nodo existente en el arreglo "nodes".
   - Riesgo operativo: "Alto" si el tiempo promedio supera 48h, "Medio" si está entre 24h y 48h, y "Bajo" si es inferior a 24h.

4. Formato de Respuesta JSON Estricto:
Responde EXCLUSIVAMENTE con un objeto JSON válido (sin código Markdown \`\`\`json, sin comentarios ni texto introductorio/final) alineado exactamente a este esquema:

{
  "nombre": "Nombre profesional y ejecutivo del flujo (máx. 6 palabras)",
  "nodes": [
    { "id": "1", "label": "Descripción clara y accionable del paso", "type": "inicio|paso|decision|fin" }
  ],
  "edges": [
    { "id": "e1-2", "source": "1", "target": "2", "label": "Sí|No|" }
  ],
  "insight": {
    "optimizacion": "Análisis técnico del principal cuello de botella o falla de diseño en el proceso",
    "sugerencia": "Recomendación táctica de automatización o reingeniería de procesos",
    "ahorro_estimado_horas": 0
  },
  "bottlenecks": [
    { "paso": "Nombre exacto del paso (coincidente con label de nodes)", "tiempo_promedio": "48h", "riesgo": "Alto|Medio|Bajo" }
  ]
}`;

// Construye el prompt final añadiendo el contexto REAL de la organización
function buildSystemPrompt(jerarquia, tipoIndustria) {
  const bloques = [];

  if (Array.isArray(jerarquia) && jerarquia.length > 0) {
    bloques.push(`CONTEXTO OBLIGATORIO — ESTRUCTURA REAL DE ESTA ORGANIZACIÓN:
Esta empresa tiene EXACTAMENTE los siguientes roles/niveles, de menor a mayor nivel de autoridad:
${jerarquia.join(" → ")}.
Reglas estrictas sobre esto:
- Cuando el proceso descrito involucre una aprobación, revisión o validación, el responsable de ese paso DEBE ser uno de estos roles exactos (usa el nombre tal cual aparece en la lista dentro del "label" del nodo, ej: "Aprobación (${jerarquia[jerarquia.length - 1]})").
- NO inventes cargos, comités, departamentos o niveles que no estén en esta lista.
- Si el proceso parece requerir más niveles de aprobación de los que existen aquí, reutiliza el nivel más alto disponible en la lista en vez de crear uno nuevo.`);
  } else {
    bloques.push(`Esta empresa no tiene una jerarquía corporativa formal registrada: usa únicamente los roles o responsables que el propio usuario mencione o dé a entender en su descripción (ej. "el encargado", "quien recibe el pedido"). NO asumas por defecto la existencia de gerentes, directores o juntas directivas si el usuario no los menciona.`);
  }

  if (tipoIndustria && tipoIndustria.trim() && tipoIndustria.trim().toLowerCase() !== "general") {
    bloques.push(`SECTOR / GIRO DE ESTA EMPRESA: "${tipoIndustria.trim()}".
Adapta el vocabulario, la terminología técnica, los nombres de los pasos y los ejemplos de bottlenecks a las buenas prácticas operativas de este sector concreto.`);
  }

  if (bloques.length === 0) return BASE_PROMPT;
  return bloques.join("\n\n") + "\n\n" + BASE_PROMPT;
}

let aiClient = null;
function getClient() {
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      vertexai: true,
      project: env.vertex.project,
      location: env.vertex.location,
    });
  }
  return aiClient;
}

export async function generateFlowFromDescription(descripcion = "", jerarquia = [], tipoIndustria = "") {
  if (isVertexConfigured()) {
    try {
      return await callGemini(descripcion, jerarquia, tipoIndustria);
    } catch (err) {
      console.error("[ai.service] Falló Vertex AI/Gemini, usando fallback simulado:", err.message);
      return simulateFlowGeneration(descripcion, jerarquia, tipoIndustria);
    }
  }
  return simulateFlowGeneration(descripcion, jerarquia, tipoIndustria);
}

async function callGemini(descripcion, jerarquia = [], tipoIndustria = "") {
  const ai = getClient();

  const response = await ai.models.generateContent({
    model: env.vertex.model,
    contents: descripcion,
    config: {
      systemInstruction: buildSystemPrompt(jerarquia, tipoIndustria),
      responseMimeType: "application/json",
      temperature: 0.3, // Temperatura baja para respuestas más estructuradas y precisas
    },
  });

  const text = response.text;
  if (!text) throw new Error("Gemini no devolvió texto en la respuesta.");

  const parsed = JSON.parse(text);
  return normalizeAiResult(parsed, jerarquia);
}

function normalizeAiResult(parsed, jerarquia = []) {
  const nodes = (parsed.nodes || []).map((n, idx) => ({
    id: String(n.id ?? idx + 1),
    label: n.label,
    type: n.type || "paso",
  }));
  const edges = (parsed.edges || []).map((e, idx) => ({
    id: e.id || `e${e.source}-${e.target}-${idx}`,
    source: String(e.source),
    target: String(e.target),
    label: e.label || "",
  }));
  return {
    nombre: parsed.nombre || "Flujo generado por IA",
    nodes,
    edges,
    insight: parsed.insight || null,
    bottlenecks: parsed.bottlenecks || [],
    tipo: jerarquia.length > 0 ? "especifico" : "general",
  };
}

function simulateFlowGeneration(descripcion, jerarquia = [], tipoIndustria = "") {
  const texto = (descripcion || "").toLowerCase();
  const nivelAprobador = jerarquia.length > 0 ? jerarquia[jerarquia.length - 1] : "Responsable";
  const tipo = jerarquia.length > 0 ? "especifico" : "general";
  const sector = tipoIndustria && tipoIndustria.trim() ? tipoIndustria.trim() : null;

  if (texto.includes("vacacion")) {
    return {
      nombre: "Solicitud de Vacaciones",
      nodes: [
        { id: "1", label: "Solicitud de Vacaciones (Empleado)", type: "inicio" },
        { id: "2", label: `¿Aprobación de ${nivelAprobador}?`, type: "decision" },
        { id: "3", label: "Notificar Empleado", type: "fin" },
        { id: "4", label: "Revisión de RRHH", type: "paso" },
        { id: "5", label: "Verificación de Días Restantes", type: "paso" },
        { id: "6", label: "Visto Bueno Final", type: "decision" },
        { id: "7", label: "Notificar Rechazo", type: "fin" },
      ],
      edges: [
        { id: "e1-2", source: "1", target: "2", label: "" },
        { id: "e2-3", source: "2", target: "3", label: "No" },
        { id: "e2-4", source: "2", target: "4", label: "Sí" },
        { id: "e4-5", source: "4", target: "5", label: "" },
        { id: "e5-6", source: "5", target: "6", label: "" },
        { id: "e6-7", source: "6", target: "7", label: "No" },
      ],
      insight: {
        optimizacion: 'El paso "Revisión de RRHH" tiene un tiempo promedio de 72 horas.',
        sugerencia: "Automatizar la verificación de días restantes mediante integración con el sistema de nómina.",
        ahorro_estimado_horas: 48,
      },
      bottlenecks: [{ paso: "Revisión de RRHH", tiempo_promedio: "72h", riesgo: "Alto" }],
      tipo,
    };
  }

  const base = splitIntoSteps(descripcion);

  const nodes = base.map((t, idx) => ({
    id: String(idx + 1),
    label: t.length > 60 ? t.slice(0, 57) + "..." : t,
    type: idx === 0 ? "inicio" : idx === base.length - 1 ? "fin" : "paso",
  }));

  const edges = nodes.slice(1).map((n, idx) => ({
    id: `e${idx + 1}-${idx + 2}`,
    source: String(idx + 1),
    target: n.id,
    label: "",
  }));

  return {
    nombre: "Flujo generado por IA",
    nodes,
    edges,
    insight: {
      optimizacion: "Se detectaron pasos manuales que podrían automatizarse.",
      sugerencia: sector
        ? `Revisa los pasos intermedios para integrarlos con las herramientas típicas de una empresa de ${sector}.`
        : "Revisa los pasos intermedios para integrarlos con tus sistemas existentes.",
      ahorro_estimado_horas: 12,
    },
    bottlenecks: nodes.length > 2 ? [{ paso: nodes[1].label, tiempo_promedio: "24h", riesgo: "Medio" }] : [],
    tipo,
  };
}

function splitIntoSteps(descripcion) {
  const cleaned = (descripcion || "")
    .trim()
    .replace(/^["“”']+|["“”']+$/g, "")
    .trim();

  const MIN_LEN = 4;

  let parts = cleaned
    .split(/[.\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= MIN_LEN);

  if (parts.length <= 1) {
    parts = cleaned
      .split(/,| y (?=[a-záéíóúñ])/i)
      .map((s) => s.trim())
      .filter((s) => s.length >= MIN_LEN);
  }

  if (parts.length === 0) {
    return ["Inicio del proceso", "Revisión", "Aprobación", "Fin del proceso"];
  }
  if (parts.length === 1) {
    return [parts[0], "Revisión", "Fin del proceso"];
  }

  return parts;
}

export async function generateReportFromFlow(flowData, jerarquia = []) {
  const { nombre, nodes, edges, insight, format = "pdf" } = flowData;

  const contextoRoles =
    Array.isArray(jerarquia) && jerarquia.length > 0
      ? `Contexto obligatorio: los roles reales de esta organización, de menor a mayor autoridad, son: ${jerarquia.join(" → ")}. Cuando menciones responsables de aprobar, revisar o ejecutar una recomendación, usa ÚNICAMENTE estos roles. No inventes cargos, gerencias o comités que no estén en esta lista.\n\n`
      : "";

  if (isVertexConfigured()) {
    try {
      const ai = getClient();
      const prompt = `
${contextoRoles}Genera un informe ejecutivo de eficiencia en formato de texto claro y profesional para el siguiente proceso:
Nombre del Flujo: ${nombre}
Nodos: ${JSON.stringify(nodes)}
Conexiones: ${JSON.stringify(edges)}
Análisis actual: ${JSON.stringify(insight)}

Incluye:
1. Resumen Ejecutivo del Proceso.
2. Identificación de Cuellos de Botella y Riesgos Operativos.
3. Recomendaciones Específicas de Automatización.
4. Conclusión y ROI Estimado.
`;

      const response = await ai.models.generateContent({
        model: env.vertex.model,
        contents: prompt,
        config: { temperature: 0.3 },
      });

      return {
        titulo: `Reporte de Eficiencia - ${nombre}`,
        formato: format,
        contenido: response.text,
      };
    } catch (err) {
      console.error("[ai.service] Falló generación de reporte con Gemini:", err.message);
    }
  }

  return {
    titulo: `Reporte de Eficiencia (Simulado) - ${nombre || "Flujo de Trabajo"}`,
    formato: format,
    contenido: `## Resumen Ejecutivo\nEl proceso "${nombre}" cuenta con ${nodes.length} pasos analizados.\n\n## Recomendación\n${insight?.sugerencia || "Optimizar tareas manuales."}`,
  };
}