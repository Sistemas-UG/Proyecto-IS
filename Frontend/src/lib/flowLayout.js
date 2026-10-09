import dagre from "dagre";
import { MarkerType } from "reactflow";

// Clases de estilo por tipo de nodo de negocio ("inicio" | "paso" | "decision" | "fin").
// Se usa tanto para el layout automático (flujos generados por IA) como para
// los nodos que el usuario agrega a mano en modo manual, así ambos se ven igual.
export function styleForTipo(tipo) {
  const base =
    "rounded-xl border p-3 text-xs font-semibold font-body text-center w-[200px] transition-colors shadow-xs ";
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

const NODE_WIDTH = 200;
const NODE_HEIGHT = 70;

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
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 90 });

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