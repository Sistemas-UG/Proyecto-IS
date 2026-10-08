import jsPDF from "jspdf";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactFlow, {
  Background, Controls, MiniMap, MarkerType, addEdge, useNodesState, useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  Sparkles, Lightbulb, FileText, FileDown, Loader2, CheckCircle2,
  PlayCircle, GitBranch, CircleDot, Square, Trash2, Wand2, MousePointerClick, Building2,
} from "lucide-react";
import AppShell, { TopBar } from "../components/AppShell";
import FlowZoomControls from "../components/FlowZoomControls";
import { api } from "../lib/api";
import { layoutNodes, layoutEdges, styleForTipo, edgeStyleForLabel } from "../lib/flowLayout";

const EXAMPLE =
  "Crear un flujo para solicitudes de vacaciones: el empleado envía la solicitud, " +
  "el gerente la revisa, si la aprueba, RRHH verifica días restantes y da el visto " +
  "bueno final. Si se rechaza en algún paso, notificar al empleado.";

// Tipos de nodo de negocio que el usuario puede agregar a mano.
const NODE_TYPES = [
  { tipo: "inicio", label: "Inicio", icon: PlayCircle, defaultLabel: "Inicio del proceso" },
  { tipo: "paso", label: "Paso", icon: Square, defaultLabel: "Nuevo paso" },
  { tipo: "decision", label: "Decisión", icon: GitBranch, defaultLabel: "¿Nueva decisión?" },
  { tipo: "fin", label: "Fin", icon: CircleDot, defaultLabel: "Fin del proceso" },
];

// Convierte el estado visual de React Flow (nodes/edges, sea que hayan venido
// de la IA o se hayan creado/editado a mano) al formato "crudo" que espera el
// backend: { id, label, type } y { id, source, target, label }.
function toRawFlow(nodes, edges) {
  const rawNodes = nodes.map((n) => ({
    id: n.id,
    label: n.data?.label ?? "",
    type: n.data?.tipo ?? "paso",
  }));
  const rawEdges = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label || "",
  }));
  return { nodes: rawNodes, edges: rawEdges };
}

export default function CrearFlujo() {
  // "ia" = describir el proceso y dejar que Gemini lo genere.
  // "manual" = construir el diagrama a mano, nodo por nodo.
  // El lienzo (nodes/edges) es compartido: se puede generar con IA y luego
  // seguir editando/agregando nodos a mano sobre el mismo diagrama.
  const [mode, setMode] = useState("ia");

  // --- Modo IA ---
  const [descripcion, setDescripcion] = useState(EXAMPLE);
  const [flujoGeneral, setFlujoGeneral] = useState(false);
  const [complejidad, setComplejidad] = useState("detallado"); // "basico" | "detallado" | "ultra"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [aiResult, setAiResult] = useState(null); // guarda insight/bottlenecks/tipo de la última generación
  const [myOrg, setMyOrg] = useState(null); // sector + jerarquía real de mi organización (solo informativo aquí)

  useEffect(() => {
    let cancelled = false;
    api
      .getMyOrganization()
      .then((res) => !cancelled && setMyOrg(res.organization))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // --- Nombre + guardado (compartido) ---
  const [flowName, setFlowName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportText, setReportText] = useState("");

  // --- Lienzo compartido ---
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selection, setSelection] = useState({ nodes: [], edges: [] });
  const counterRef = useRef(0);

  const markDirty = () => setSaved(false);

  const onConnect = useCallback(
    (c) => {
      markDirty();
      setEdges((eds) => addEdge({ ...c, markerEnd: { type: MarkerType.ArrowClosed } }, eds));
    },
    [setEdges]
  );

  const onSelectionChange = useCallback((sel) => setSelection(sel), []);

  // Agrega un nodo nuevo al lienzo (modo manual, o para completar un flujo generado por IA).
  const handleAddNode = (tipoInfo) => {
    counterRef.current += 1;
    const id = `manual-${Date.now()}-${counterRef.current}`;
    const index = nodes.length;
    const col = index % 3;
    const row = Math.floor(index / 3);
    const newNode = {
      id,
      position: { x: 80 + col * 240, y: 60 + row * 140 },
      data: { label: tipoInfo.defaultLabel, tipo: tipoInfo.tipo },
      className: styleForTipo(tipoInfo.tipo),
    };
    markDirty();
    setNodes((nds) => nds.concat(newNode));
  };

  // Doble clic en un nodo -> editar su texto.
  const onNodeDoubleClick = useCallback(
    (_evt, node) => {
      const next = window.prompt("Editar texto del paso:", node.data?.label || "");
      if (next === null) return;
      markDirty();
      setNodes((nds) => nds.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, label: next } } : n)));
    },
    [setNodes]
  );

  // Doble clic en una conexión -> editar su etiqueta (ej. "Sí" / "No").
  const onEdgeDoubleClick = useCallback(
    (_evt, edge) => {
      const next = window.prompt('Editar etiqueta de la conexión (ej. "Sí", "No", o vacío):', edge.label || "");
      if (next === null) return;
      markDirty();
      setEdges((eds) =>
        eds.map((e) => (e.id === edge.id ? { ...e, label: next || undefined, ...edgeStyleForLabel(next) } : e))
      );
    },
    [setEdges]
  );

  const hasSelection = selection.nodes.length > 0 || selection.edges.length > 0;

  const handleDeleteSelection = () => {
    const nodeIds = new Set(selection.nodes.map((n) => n.id));
    const edgeIds = new Set(selection.edges.map((e) => e.id));
    markDirty();
    setNodes((nds) => nds.filter((n) => !nodeIds.has(n.id)));
    setEdges((eds) => eds.filter((e) => !edgeIds.has(e.id) && !nodeIds.has(e.source) && !nodeIds.has(e.target)));
    setSelection({ nodes: [], edges: [] });
  };

  const handleGenerar = async () => {
    if (!descripcion.trim()) return;
    setLoading(true);
    setSaved(false);
    setReportText("");
    setError("");
    try {
      const result = await api.generateFlow(descripcion, flujoGeneral, complejidad);
      setAiResult(result);
      setFlowName(result.nombre || "");
      setNodes(layoutNodes(result.nodes, result.edges));
      setEdges(layoutEdges(result.edges));
    } catch (err) {
      setError(err.message || "No se pudo generar el flujo.");
    } finally {
      setLoading(false);
    }
  };

  const handleGuardar = async () => {
    if (!nodes.length) return;
    setSaving(true);
    setError("");
    try {
      const { nodes: rawNodes, edges: rawEdges } = toRawFlow(nodes, edges);
      await api.createFlow({
        nombre: flowName.trim() || "Flujo sin nombre",
        pasos: rawNodes.length,
        estado: "Activo",
        nodes: rawNodes,
        edges: rawEdges,
        aiInsight: aiResult?.insight || null,
        // "especifico" solo si vino de la IA usando la jerarquía real de la
        // organización; cualquier flujo construido o editado a mano se marca
        // como "general".
        tipo: aiResult?.tipo && mode === "ia" ? aiResult.tipo : "general",
      });
      setSaved(true);
    } catch (err) {
      setError(err.message || "No se pudo guardar el flujo.");
    } finally {
      setSaving(false);
    }
  };

  // Genera el PDF del reporte con soporte de múltiples páginas y dispara la descarga.
  const descargarPDF = (texto) => {
    if (!texto) return;
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const margin = 40;
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`Reporte de Eficiencia — ${flowName.trim() || "Flujo sin nombre"}`, margin, 50);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const lines = doc.splitTextToSize(texto, 515);
    let cursorY = 80;
    const lineHeight = 14;

    lines.forEach((line) => {
      if (cursorY + lineHeight > pageHeight - margin) {
        doc.addPage();
        cursorY = margin;
      }
      doc.text(line, margin, cursorY);
      cursorY += lineHeight;
    });

    doc.save(`reporte-eficiencia-${flowName.trim() || "flujo"}.pdf`);
  };

  const handleGenerarReporte = async () => {
    if (!nodes.length) return;
    setReportLoading(true);
    setError("");
    try {
      const { nodes: rawNodes, edges: rawEdges } = toRawFlow(nodes, edges);
      const report = await api.generateReport({
        nombre: flowName.trim() || "Flujo sin nombre",
        nodes: rawNodes,
        edges: rawEdges,
        insight: aiResult?.insight || null,
        format: "pdf",
      });
      setReportText(report.contenido);
      descargarPDF(report.contenido);
    } catch (err) {
      setError(err.message || "No se pudo generar el reporte.");
    } finally {
      setReportLoading(false);
    }
  };

  const handleDescargarPDF = () => descargarPDF(reportText);

  const hasNodes = nodes.length > 0;

  return (
    <AppShell>
      <TopBar title="Crear Nuevo Flujo" subtitle="Describe tu proceso con IA, constrúyelo a mano, o combina ambos." />
      <div className="flex-1 overflow-hidden flex bg-bg dark:bg-navyDeep transition-colors">
        {/* Panel izquierdo */}
        <div className="w-[340px] shrink-0 border-r border-border dark:border-navyCard bg-white dark:bg-navy p-6 flex flex-col overflow-auto transition-colors">
          {/* Tabs de modo */}
          <div className="flex rounded-lg border border-border dark:border-navyCard p-1 mb-5 bg-bg dark:bg-navyDeep">
            <button
              onClick={() => setMode("ia")}
              className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold font-body rounded-md py-2 transition-colors cursor-pointer ${
                mode === "ia" ? "bg-navy dark:bg-blue text-white" : "text-muted dark:text-faint hover:text-ink dark:hover:text-white"
              }`}
            >
              <Wand2 size={13} /> Generar con IA
            </button>
            <button
              onClick={() => setMode("manual")}
              className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold font-body rounded-md py-2 transition-colors cursor-pointer ${
                mode === "manual" ? "bg-navy dark:bg-blue text-white" : "text-muted dark:text-faint hover:text-ink dark:hover:text-white"
              }`}
            >
              <MousePointerClick size={13} /> Construir manual
            </button>
          </div>

          {mode === "ia" ? (
            <>
              <label className="text-xs font-semibold text-ink dark:text-white font-body mb-2">
                1. Describe tu flujo en lenguaje natural (Español)
              </label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={6}
                className="w-full text-sm rounded-lg border border-border dark:border-navyCard bg-bg dark:bg-navyDeep p-3 text-ink dark:text-white font-body outline-none focus:border-blue resize-none mb-4 transition-colors placeholder:text-muted/60 dark:placeholder:text-faint/50"
                placeholder="Describe tu proceso de negocio en lenguaje natural…"
              />

              {/* Selector de Nivel de Profundidad */}
              <label className="text-xs font-semibold text-ink dark:text-white font-body mb-1 block">
                Profundidad del diagrama
              </label>
              <select
                value={complejidad}
                onChange={(e) => setComplejidad(e.target.value)}
                className="w-full text-xs rounded-lg border border-border dark:border-navyCard bg-bg dark:bg-navyDeep p-2.5 text-ink dark:text-white font-body outline-none focus:border-blue mb-4 transition-colors cursor-pointer"
              >
                <option value="basico">Básico (Estructura simple)</option>
                <option value="detallado">Detallado (8 - 12 pasos con excepciones)</option>
                <option value="ultra">Enterprise Ultra (12 - 18 pasos, auditoría y notificaciones)</option>
              </select>

              <label className="flex items-start gap-2 text-xs text-muted dark:text-faint font-body mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={flujoGeneral}
                  onChange={(e) => setFlujoGeneral(e.target.checked)}
                  className="mt-0.5 accent-blue"
                />
                <span>
                  Generar como flujo <strong className="text-ink dark:text-white">general</strong> (ignora la jerarquía
                  de mi organización — útil para plantillas reutilizables por otras empresas)
                </span>
              </label>

              {!flujoGeneral && myOrg && (
                <div className="flex items-start gap-2 text-[11px] text-muted dark:text-faint font-body rounded-lg border border-border dark:border-navyCard bg-bg dark:bg-navyDeep p-3 mb-4">
                  <Building2 size={13} className="text-blue shrink-0 mt-0.5" />
                  <span>
                    Se generará usando el contexto de <strong className="text-ink dark:text-white">{myOrg.nombre}</strong>
                    {myOrg.tipo_industria ? <> ({myOrg.tipo_industria})</> : null}: solo se usarán los roles{" "}
                    <strong className="text-ink dark:text-white">{(myOrg.jerarquia || []).join(", ") || "—"}</strong>.{" "}
                    Puedes editar esto en Configuración.
                  </span>
                </div>
              )}

              <button
                onClick={handleGenerar}
                disabled={loading}
                className="w-full rounded-lg text-sm font-semibold text-white py-3 flex items-center justify-center gap-2 font-body disabled:opacity-70 bg-navy dark:bg-blue hover:opacity-90 transition-all cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Analizando descripción…
                  </>
                ) : (
                  <>
                    <Sparkles size={15} /> Generar Flujo con IA
                  </>
                )}
              </button>

              <p className="text-[11px] text-faint font-body mt-3">
                Tip: después de generarlo, puedes cambiar a "Construir manual" para agregar, editar o
                eliminar pasos sobre el mismo diagrama.
              </p>
            </>
          ) : (
            <>
              <label className="text-xs font-semibold text-ink dark:text-white font-body mb-2">
                Agrega nodos al lienzo
              </label>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {NODE_TYPES.map((t) => (
                  <button
                    key={t.tipo}
                    onClick={() => handleAddNode(t)}
                    className="flex items-center gap-1.5 text-xs font-medium text-ink dark:text-white border border-border dark:border-navyCard rounded-lg px-3 py-2.5 font-body bg-bg dark:bg-navyDeep hover:border-blue transition-colors cursor-pointer"
                  >
                    <t.icon size={14} className="text-blue" /> {t.label}
                  </button>
                ))}
              </div>

              <button
                onClick={handleDeleteSelection}
                disabled={!hasSelection}
                className="w-full flex items-center justify-center gap-2 text-xs font-medium text-red border border-red/30 rounded-lg px-3 py-2.5 font-body bg-redSoft dark:bg-red/10 hover:opacity-90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mb-4 cursor-pointer"
              >
                <Trash2 size={13} /> Eliminar seleccionado
              </button>

              <ul className="text-[11px] leading-relaxed text-muted dark:text-faint font-body list-disc pl-4 space-y-1">
                <li>Arrastra desde el borde de un nodo hasta otro para conectarlos.</li>
                <li>Doble clic en un nodo o conexión para editar su texto.</li>
                <li>Haz clic para seleccionar y usa "Eliminar seleccionado" (o la tecla Supr).</li>
              </ul>
            </>
          )}

          {error && <p className="text-xs text-red font-body mt-3">{error}</p>}

          {/* Caja AI Insight (si la última generación con IA la produjo) */}
          {aiResult?.insight && (
            <div className="mt-6 rounded-xl p-4 bg-blueSoft dark:bg-blue/15 border border-blue/20 dark:border-blue/30 transition-colors">
              <p className="text-xs font-semibold text-ink dark:text-white font-body mb-2 flex items-center gap-1.5">
                <Lightbulb size={13} className="text-blue dark:text-blue-400" /> AI Insight
              </p>
              <p className="text-xs leading-relaxed text-muted dark:text-faint font-body mb-2">
                <strong className="text-ink dark:text-white">Optimización inteligente:</strong> {aiResult.insight.optimizacion}
              </p>
              <p className="text-xs leading-relaxed text-muted dark:text-faint font-body mb-2">
                <strong className="text-ink dark:text-white">Sugerencia:</strong> {aiResult.insight.sugerencia}
              </p>
              <p className="text-xs text-green dark:text-emerald-400 font-semibold font-body">
                Ahorro estimado: {aiResult.insight.ahorro_estimado_horas} horas
              </p>
            </div>
          )}

          {/* Nombre + Guardar / Reportes — disponible sin importar el modo, apenas haya nodos */}
          {hasNodes && (
            <div className="mt-6">
              <p className="text-xs font-semibold text-ink dark:text-white font-body mb-2">Nombre del flujo</p>
              <input
                value={flowName}
                onChange={(e) => {
                  setFlowName(e.target.value);
                  markDirty();
                }}
                placeholder="Nombre del flujo"
                className="w-full text-sm rounded-lg border border-border dark:border-navyCard bg-bg dark:bg-navyDeep p-2.5 text-ink dark:text-white font-body outline-none focus:border-blue mb-4 transition-colors"
              />

              <p className="text-xs font-semibold text-ink dark:text-white font-body mb-3">Guardar flujo</p>
              <button
                onClick={handleGuardar}
                disabled={saving || saved}
                className={`w-full flex items-center justify-center gap-2 text-xs font-semibold text-white rounded-lg px-3 py-2.5 font-body disabled:opacity-70 mb-4 transition-colors cursor-pointer ${
                  saved ? "bg-green dark:bg-emerald-600" : "bg-blue hover:bg-blue/90"
                }`}
              >
                {saved ? (
                  <>
                    <CheckCircle2 size={14} /> Guardado en Mis Flujos
                  </>
                ) : saving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Guardando…
                  </>
                ) : (
                  "Guardar en Mis Flujos"
                )}
              </button>

              <p className="text-xs font-semibold text-ink dark:text-white font-body mb-3">Generación de documentos</p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleGenerarReporte}
                  disabled={reportLoading}
                  className="flex items-center gap-2 text-xs font-medium text-ink dark:text-white border border-border dark:border-navyCard rounded-lg px-3 py-2.5 font-body bg-bg dark:bg-navyDeep hover:border-muted transition-colors disabled:opacity-70 cursor-pointer"
                >
                  {reportLoading ? (
                    <Loader2 size={14} className="animate-spin text-red" />
                  ) : (
                    <FileText size={14} className="text-red" />
                  )}
                  {reportLoading ? "Generando reporte…" : "Reporte de Eficiencia (con IA)"}
                </button>
                <button
                  onClick={handleDescargarPDF}
                  disabled={!reportText}
                  className="flex items-center gap-2 text-xs font-medium text-ink dark:text-white border border-border dark:border-navyCard rounded-lg px-3 py-2.5 font-body bg-bg dark:bg-navyDeep hover:border-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <FileDown size={14} className="text-blue" /> Descargar PDF del Reporte
                </button>
              </div>
              {reportText && (
                <div className="mt-3 rounded-lg border border-border dark:border-navyCard bg-bg dark:bg-navyDeep p-3 max-h-48 overflow-auto">
                  <p className="text-[11px] leading-relaxed text-muted dark:text-faint font-body whitespace-pre-wrap">
                    {reportText}
                  </p>
                  <p className="text-[10px] text-green dark:text-emerald-400 font-body mt-2">
                    ✓ Guardado permanentemente — disponible en Reportes → "Insights de IA guardados"
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Lienzo React Flow */}
        <div className="flex-1 relative bg-bg dark:bg-navyDeep transition-colors">
          {!hasNodes && !loading && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-sm text-faint font-body text-center px-6">
                El diagrama aparecerá aquí. Genéralo con IA o agrega tu primer nodo desde
                "Construir manual".
              </p>
            </div>
          )}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDoubleClick={onNodeDoubleClick}
            onEdgeDoubleClick={onEdgeDoubleClick}
            onSelectionChange={onSelectionChange}
            deleteKeyCode={["Backspace", "Delete"]}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#64708A" gap={20} size={1} />
            <Controls />
            <FlowZoomControls />
            <MiniMap
              nodeColor={() => "#2F6FED"}
              maskColor="rgba(15, 27, 51, 0.6)"
              className="bg-white dark:bg-navy border border-border dark:border-navyCard rounded-lg"
            />
          </ReactFlow>
        </div>
      </div>
    </AppShell>
  );
}