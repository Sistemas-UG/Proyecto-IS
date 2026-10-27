import dagre from "dagre";
import { MarkerType } from "reactflow";

export const NODE_WIDTH = 220;
export const NODE_HEIGHT = 86;
// Separación vertical aumentada para dar aire a las etiquetas Sí/No y flechas
export const RANK_SEP = 140;
// Separación horizontal para ramas paralelas (evita que las decisiones se peguen)
export const NODE_SEP = 120;

// Clases de estilo por tipo de nodo
export function styleForTipo(tipo) {
  const base =
    `rounded-xl border p-2.5 text-xs font-semibold font-body text-center w-[${NODE_WIDTH}px] h-[${NODE_HEIGHT}px] ` +
    "flex items-center justify-center leading-snug line-clamp-3 overflow-hidden transition-colors shadow-xs ";
  if (tipo === "inicio") return base + "bg-navyDeep dark:bg-blue text-white border-transparent";
  if (tipo === "fin") return base + "bg-greenSoft dark:bg-green/20 text-green dark:text-emerald-400 border-green/30 dark:border-green/40";
  if (tipo === "decision") return base + "bg-white dark:bg-navy text-ink dark:text-white border-blue dark:border-blue";
  return base + "bg-white dark:bg-navy text-ink dark:text-white border-border dark:border-navyCard";
}

// Estilo de conexiones con fondo para las etiquetas
export function edgeStyleForLabel(label) {
  const isNo = label === "No";
  const isSi = label === "Sí" || label === "Si";
  return {
    style: isNo ? { stroke: "#D6414B", strokeWidth: 2 } : isSi ? { stroke: "#12946B", strokeWidth: 2 } : { strokeWidth: 1.5 },
    labelStyle: isNo ? { fill: "#D6414B", fontWeight: 700, fontSize: 11 } : isSi ? { fill: "#12946B", fontWeight: 700, fontSize: 11 } : { fontSize: 11 },
    labelBgPadding: [6, 4],
    labelBgBorderRadius: 6,
    labelBgStyle: { fill: "#ffffff", fillOpacity: 0.95 },
  };
}

// Layout automático optimizado para Dagre + React Flow
export function layoutNodes(rawNodes, rawEdges) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  
  // Configuración para evitar cruce y amontonamiento en grafos complejos
  g.setGraph({
    rankdir: "TB",
    nodesep: NODE_SEP,
    ranksep: RANK_SEP,
    edgesep: 40,
    ranker: "network-simplex",
  });

  rawNodes.forEach((n) => {
    g.setNode(String(n.id), { width: NODE_WIDTH, height: NODE_HEIGHT });
  });
  rawEdges.forEach((e) => {
    g.setEdge(String(e.source), String(e.target));
  });

  dagre.layout(g);

  return rawNodes.map((n) => {
    const pos = g.node(String(n.id));
    return {
      id: String(n.id),
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
      data: { label: n.label || n.data?.label || "", tipo: n.type || n.data?.tipo || "paso" },
      className: styleForTipo(n.type || n.data?.tipo),
    };
  });
}

// Conexiones cuadradas/curvadas (smoothstep) que rodean las cajas
export function layoutEdges(rawEdges) {
  return rawEdges.map((e) => ({
    id: e.id,
    source: String(e.source),
    target: String(e.target),
    type: "smoothstep", // Evita que las líneas atraviesen los nodos en diagonal
    label: e.label || undefined,
    ...edgeStyleForLabel(e.label),
    markerEnd: { type: MarkerType.ArrowClosed },
  }));
}

// Geometría para exportación en PDF
export function layoutFlowGeometry(rawNodes = [], rawEdges = []) {
  const ids = new Set(rawNodes.map((n) => String(n.id)));
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  
  g.setGraph({
    rankdir: "TB",
    nodesep: NODE_SEP,
    ranksep: RANK_SEP,
    edgesep: 40,
    ranker: "network-simplex",
  });

  rawNodes.forEach((n) => g.setNode(String(n.id), { width: NODE_WIDTH, height: NODE_HEIGHT }));

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