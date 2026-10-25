import dagre from "dagre";
import { MarkerType } from "reactflow";

// Clases de estilo por tipo de nodo de negocio ("inicio" | "paso" | "decision" | "fin").
// Se usa tanto para el layout automático (flujos generados por IA) como para
// los nodos que el usuario agrega a mano en modo manual, así ambos se ven igual.
//
// Alto FIJO (h-[NODE_HEIGHT]) + line-clamp-3: así el tamaño real que dibuja
// el navegador siempre coincide con el tamaño que usamos para calcular el
// layout (NODE_WIDTH x NODE_HEIGHT más abajo). Antes el nodo crecía con el
// texto (sin alto fijo) y como dagre separaba los nodos asumiendo un alto
// de 70px, una etiqueta larga hacía que la caja real fuera más alta que eso
// y se encimara con el nodo de abajo. Con alto fijo + recorte de texto a 3
// líneas, eso ya no puede pasar sin importar qué tan largo sea el texto.
export function styleForTipo(tipo) {
  const base =
    `rounded-xl border p-2.5 text-xs font-semibold font-body text-center w-[${NODE_WIDTH}px] h-[${NODE_HEIGHT}px] ` +
    "flex items-center justify-center leading-snug line-clamp-3 overflow-hidden transition-colors shadow-xs ";
  if (tipo === "inicio") return base + "bg-navyDeep dark:bg-blue text-white border-transparent";
  if (tipo === "fin") return base + "bg-greenSoft dark:bg-green/20 text-green dark:text-emerald-400 border-green/30 dark:border-green/40";
  if (tipo === "decision") return base + "bg-white dark:bg-navy text-ink dark:text-white border-blue dark:border-blue";
  return base + "bg-white dark:bg-navy text-ink dark:text-white border-border dark:border-navyCard"; // "paso"
}

// Estilo (color de línea/etiqueta) de una conexión según su label ("Sí"/"No"/otro).
// Compartido entre el layout inicial y la edición manual de conexiones.
export function edgeStyleForLabel(label) {
  const isNo = label === "No";
  const isSi = label === "Sí" || label === "Si";
  return {
    style: isNo ? { stroke: "#D6414B" } : isSi ? { stroke: "#12946B" } : undefined,
    labelStyle: isNo ? { fill: "#D6414B", fontWeight: 700 } : isSi ? { fill: "#12946B", fontWeight: 700 } : undefined,
  };
}

export const NODE_WIDTH = 200;
// Antes 70: muy ajustado para etiquetas de 2-3 líneas en flujos más
// complejos (varias decisiones encadenadas). Con 86px entran 3 líneas de
// texto cómodas y, al ser un alto fijo (ver styleForTipo), dagre separa los
// nodos con el tamaño real exacto.
export const NODE_HEIGHT = 86;
export const RANK_SEP = 110;
// Separación horizontal entre nodos de un mismo nivel (antes 60). Con flujos
// de muchas ramas (varias decisiones en paralelo) 60px dejaba las cajas casi
// pegadas; con 80px queda aire incluso con 4-5 ramas lado a lado.
export const NODE_SEP = 80;

// Convierte nodos/edges del backend al formato de React Flow.
// Compartido entre CrearFlujo.jsx (admin, genera con IA y/o construye a mano)
// y VerFlujo.jsx (cualquier usuario, solo lectura) para que ambos se vean igual.
//
// El layout automático lo calcula dagre: arma el grafo real con las
// conexiones (edges), ordena por niveles de arriba hacia abajo, y separa
// cada nodo lo suficiente para que no se encimen ni se crucen las líneas
// (a diferencia del centrado manual anterior, que no consideraba bien las
// ramas que vuelven a converger en un mismo nodo, como "Aprueba"/"Rechaza" → "Fin").
export function layoutNodes(rawNodes, rawEdges) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: NODE_SEP, ranksep: RANK_SEP });

  rawNodes.forEach((n) => {
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });
  rawEdges.forEach((e) => {
    g.setEdge(e.source, e.target);
  });

  dagre.layout(g);

  return rawNodes.map((n) => {
    const pos = g.node(n.id);
    return {
      id: n.id,
      // dagre devuelve el CENTRO del nodo; React Flow posiciona desde la
      // esquina superior izquierda, por eso restamos la mitad del tamaño.
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
      // Guardamos el tipo de negocio ("inicio"|"paso"|"decision"|"fin") en data.tipo
      // para poder reconstruir el flujo "crudo" (para guardar/editar) a partir
      // del estado visual de React Flow, tanto si vino de la IA como si el
      // usuario lo editó/creó a mano después.
      data: { label: n.label, tipo: n.type || "paso" },
      className: styleForTipo(n.type),
    };
  });
}

export function layoutEdges(rawEdges) {
  return rawEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label || undefined,
    ...edgeStyleForLabel(e.label),
    markerEnd: { type: MarkerType.ArrowClosed },
  }));
}

// Geometría del diagrama para exportarlo (por ejemplo al PDF del reporte).
// Usa dagre con EXACTAMENTE los mismos parámetros que layoutNodes, así el
// diagrama del PDF se ve igual que el de Mis Flujos / Ver Flujo.
// Devuelve nodos con esquina superior izquierda + tamaño, y por cada conexión
// los puntos del trazo que calcula dagre (para dibujarlas sin cruzar nodos).
export function layoutFlowGeometry(rawNodes = [], rawEdges = []) {
  const ids = new Set(rawNodes.map((n) => String(n.id)));
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: NODE_SEP, ranksep: RANK_SEP });

  rawNodes.forEach((n) => g.setNode(String(n.id), { width: NODE_WIDTH, height: NODE_HEIGHT }));

  // Solo conexiones cuyos extremos existen (dagre rompe con nodos fantasma).
  const validEdges = rawEdges.filter((e) => ids.has(String(e.source)) && ids.has(String(e.target)));
  validEdges.forEach((e) => g.setEdge(String(e.source), String(e.target)));

  dagre.layout(g);

  const nodes = rawNodes.map((n) => {
    const pos = g.node(String(n.id));
    return {
      id: String(n.id),
      label: n.label ?? n.data?.label ?? "",
      type: n.type ?? n.data?.tipo ?? "paso",
      x: pos.x - NODE_WIDTH / 2,
      y: pos.y - NODE_HEIGHT / 2,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    };
  });

  const edges = validEdges.map((e, idx) => {
    const info = g.edge(String(e.source), String(e.target));
    return {
      id: e.id || `e${idx}`,
      source: String(e.source),
      target: String(e.target),
      label: e.label || "",
      points: (info?.points || []).map((p) => ({ x: p.x, y: p.y })),
    };
  });

  const graph = g.graph();
  return { nodes, edges, width: graph.width || NODE_WIDTH, height: graph.height || NODE_HEIGHT };
}