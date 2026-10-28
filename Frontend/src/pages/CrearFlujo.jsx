import { useCallback, useEffect, useRef, useState } from "react";
import ReactFlow, {
  Background, Controls, MiniMap, MarkerType, addEdge, useNodesState, useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  Sparkles, Lightbulb, FileText, FileDown, Loader2, CheckCircle2,
  PlayCircle, GitBranch, CircleDot, Square, Trash2, Wand2, MousePointerClick, Building2,
  UploadCloud, X, Edit3, Eye, ChevronDown,
} from "lucide-react";
import AppShell, { TopBar } from "../components/AppShell";
import FlowZoomControls from "../components/FlowZoomControls";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { layoutNodes, layoutEdges, styleForTipo, edgeStyleForLabel } from "../lib/flowLayout";
import { crearReportePDF } from "../lib/reportPdf";
import { extractPdfText } from "../lib/pdfText";

const NODE_TYPES = [
  { tipo: "inicio", label: "Inicio", icon: PlayCircle, defaultLabel: "Inicio del proceso" },
  { tipo: "paso", label: "Paso", icon: Square, defaultLabel: "Nuevo paso" },
  { tipo: "decision", label: "Decisión", icon: GitBranch, defaultLabel: "¿Nueva decisión?" },
  { tipo: "fin", label: "Fin", icon: CircleDot, defaultLabel: "Fin del proceso" },
];

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
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [mode, setMode] = useState("ia");

  // --- Modo IA ---
  const [descripcion, setDescripcion] = useState("");
  const [flujoGeneral, setFlujoGeneral] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [aiResult, setAiResult] = useState(null);
  const [myOrg, setMyOrg] = useState(null);

  // --- Carga de Protocolo PDF ---
  const pdfInputRef = useRef(null);
  const [extractingPdf, setExtractingPdf] = useState(false);

  // --- Estado para Modal de Edición ---
  const [editModal, setEditModal] = useState({
    isOpen: false,
    type: null, // 'node' | 'edge'
    id: null,
    label: "",
  });

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

  // --- Nombre + guardado ---
  const [flowName, setFlowName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reportPdfUrl, setReportPdfUrl] = useState("");
  const [reportFilename, setReportFilename] = useState("");
  const [savedFlowId, setSavedFlowId] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [insightOpen, setInsightOpen] = useState(false);

  // --- Lienzo compartido ---
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selection, setSelection] = useState({ nodes: [], edges: [] });
  const counterRef = useRef(0);

  const markDirty = () => setSaved(false);

  // Conexión limpia con curvas 'smoothstep' y flecha azul
  const onConnect = useCallback(
    (c) => {
      markDirty();
      setEdges((eds) =>
        addEdge(
          {
            ...c,
            type: "smoothstep",
            style: { stroke: "#3b82f6", strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#3b82f6" },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  const onSelectionChange = useCallback((sel) => setSelection(sel), []);

  const handleAddNode = (tipoInfo) => {
    counterRef.current += 1;
    const id = `manual-${Date.now()}-${counterRef.current}`;
    const index = nodes.length;
    const col = index % 3;
    const row = Math.floor(index / 3);
    const newNode = {
      id,
      position: { x: 80 + col * 260, y: 60 + row * 160 },
      data: { label: tipoInfo.defaultLabel, tipo: tipoInfo.tipo },
      className: styleForTipo(tipoInfo.tipo),
    };
    markDirty();
    setNodes((nds) => nds.concat(newNode));
  };

  // Doble clic en un nodo -> abre modal
  const onNodeDoubleClick = useCallback((_evt, node) => {
    setEditModal({
      isOpen: true,
      type: "node",
      id: node.id,
      label: node.data?.label || "",
    });
  }, []);

  // Doble clic en una conexión -> abre modal
  const onEdgeDoubleClick = useCallback((_evt, edge) => {
    setEditModal({
      isOpen: true,
      type: "edge",
      id: edge.id,
      label: edge.label || "",
    });
  }, []);

  // Guardar cambios desde el modal
  const handleSaveModal = (e) => {
    e.preventDefault();
    if (!editModal.id) return;
    markDirty();

    if (editModal.type === "node") {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === editModal.id ? { ...n, data: { ...n.data, label: editModal.label } } : n
        )
      );
    } else if (editModal.type === "edge") {
      setEdges((eds) =>
        eds.map((e) =>
          e.id === editModal.id
            ? { ...e, label: editModal.label || undefined, ...edgeStyleForLabel(editModal.label) }
            : e
        )
      );
    }

    setEditModal({ isOpen: false, type: null, id: null, label: "" });
  };

  const hasSelection = selection.nodes.length > 0 || selection.edges.length > 0;

  const handleDeleteSelection = () => {
    const nodeIds = new Set(selection.nodes.map((n) => n.id));
    const edgeIds = new Set(selection.edges.map((e) => e.id));
    markDirty();
    setNodes((nds) => nds.filter((n) => !nodeIds.has(n.id)));
    setEdges((eds) => eds.filter((e) => !edgeIds.has(e.id) && !nodeIds.has(e.source) && !nodeIds.has(e.target)));
    setSelection({ nodes: [], edges: [] });
  };

  // --- Genera el flujo con IA. Si viene texto del PDF lo usa; si no, la descripción escrita ---
  const handleGenerar = async (textoOverride) => {
    const texto = typeof textoOverride === "string" ? textoOverride : descripcion;
    if (!texto.trim()) return;
    setLoading(true);
    setSaved(false);
    setSavedFlowId(null);
    setReportText("");
    setInsightOpen(false);
    setError("");
    try {
      const result = await api.generateFlow(texto, flujoGeneral);
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

  // --- Protocolo PDF: se lee en el navegador y se genera el flujo solo ---
  const handlePdfSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.type !== "application/pdf") {
      setError("Selecciona un archivo PDF.");
      return;
    }

    setExtractingPdf(true);
    setError("");
    try {
      const texto = await extractPdfText(file);
      if (texto.length < 40) {
        throw new Error("No se encontró texto en el PDF. Si es un documento escaneado (imagen), no se puede leer.");
      }
      setMode("ia");
      setDescripcion(texto);
      setExtractingPdf(false);
      await handleGenerar(texto);
    } catch (err) {
      setError(err.message || "No se pudo leer el PDF.");
    } finally {
      setExtractingPdf(false);
    }
  };

  const handleGuardar = async () => {
    if (!nodes.length) return;
    setSaving(true);
    setError("");
    try {
      const { nodes: rawNodes, edges: rawEdges } = toRawFlow(nodes, edges);
      const created = await api.createFlow({
        nombre: flowName.trim() || "Flujo sin nombre",
        pasos: rawNodes.length,
        estado: "Activo",
        nodes: rawNodes,
        edges: rawEdges,
        aiInsight: aiResult?.insight || null,
        tipo: aiResult?.tipo && mode === "ia" ? aiResult.tipo : "general",
      });
      setSavedFlowId(created?.flow?.id ?? created?.id ?? null);
      setSaved(true);
    } catch (err) {
      setError(err.message || "No se pudo guardar el flujo.");
    } finally {
      setSaving(false);
    }
  };

  const prepararPDF = ({ titulo, texto, generatedEn, flow }) => {
    if (!texto) return;
    const { blob, filename } = crearReportePDF({
      titulo,
      texto,
      generatedEn,
      ahorroHoras: aiResult?.insight?.ahorro_estimado_horas,
      flow,
    });
    setReportFilename(filename);
    setReportPdfUrl((oldUrl) => {
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      return URL.createObjectURL(blob);
    });
  };

  const handleGenerarReporte = async () => {
    if (!nodes.length) return;
    setReportLoading(true);
    setError("");
    try {
      const { nodes: rawNodes, edges: rawEdges } = toRawFlow(nodes, edges);
      const nombreFlujo = flowName.trim() || "Flujo sin nombre";
      const report = await api.generateReport({
        flujoId: savedFlowId || undefined,
        nombre: nombreFlujo,
        nodes: rawNodes,
        edges: rawEdges,
        insight: aiResult?.insight || null,
        format: "pdf",
      });
      setReportText(report.contenido);
      prepararPDF({
        titulo: report.titulo || `Reporte de Eficiencia - ${nombreFlujo}`,
        texto: report.contenido,
        generatedEn: report.generatedEn,
        flow: { nodes: rawNodes, edges: rawEdges },
      });
    } catch (err) {
      setError(err.message || "No se pudo generar el reporte.");
    } finally {
      setReportLoading(false);
    }
  };

  const handleDescargarPDF = () => {
    if (!reportPdfUrl) return;
    const link = document.createElement("a");
    link.href = reportPdfUrl;
    link.download = reportFilename || "reporte-eficiencia.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };
  useEffect(() => () => { if (reportPdfUrl) URL.revokeObjectURL(reportPdfUrl); }, [reportPdfUrl]);

  const hasNodes = nodes.length > 0;

  return (
    <AppShell>
      <TopBar title="Crear Nuevo Flujo" subtitle="Describe tu proceso con IA, constrúyelo a mano, o combina ambos." />
      <div className="flex-1 overflow-hidden flex bg-bg dark:bg-navyDeep transition-colors">
        {/* Panel izquierdo */}
        <div className="w-[340px] shrink-0 border-r border-border dark:border-navyCard bg-white dark:bg-navy p-5 flex flex-col overflow-auto transition-colors">
          {/* Tabs de modo */}
          <div className="flex rounded-lg border border-border dark:border-navyCard p-1 mb-4 bg-bg dark:bg-navyDeep">
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
              {isAdmin && (
                <>
                  <input
                    type="file"
                    accept="application/pdf"
                    ref={pdfInputRef}
                    onChange={handlePdfSelected}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => pdfInputRef.current?.click()}
                    disabled={extractingPdf || loading}
                    className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-ink dark:text-white border border-dashed border-border dark:border-navyCard rounded-lg py-2.5 font-body bg-bg dark:bg-navyDeep hover:border-blue transition-colors disabled:opacity-70 mb-2 cursor-pointer"
                  >
                    {extractingPdf ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Leyendo PDF…
                      </>
                    ) : (
                      <>
                        <UploadCloud size={14} className="text-blue" /> Cargar Protocolo PDF
                      </>
                    )}
                  </button>
                  <p className="text-[11px] text-faint font-body mb-3">
                    Sube un PDF: se lee el texto y se genera el flujo automáticamente.
                  </p>
                </>
              )}

              <label className="text-xs font-semibold text-ink dark:text-white font-body mb-2">
                Describe tu flujo en lenguaje natural (Español)
              </label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={6}
                className="w-full text-sm rounded-lg border border-border dark:border-navyCard bg-bg dark:bg-navyDeep p-3 text-ink dark:text-white font-body outline-none focus:border-blue resize-none mb-3 transition-colors placeholder:text-muted/60 dark:placeholder:text-faint/50"
                placeholder='Ej: "Crear un flujo para solicitudes de vacaciones: el empleado envía la solicitud, el gerente la revisa, si la aprueba, RRHH verifica días restantes y da el visto bueno final. Si se rechaza en algún paso, notificar al empleado."'
              />

              <label className="flex items-start gap-2 text-xs text-muted dark:text-faint font-body mb-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={flujoGeneral}
                  onChange={(e) => setFlujoGeneral(e.target.checked)}
                  className="mt-0.5 accent-blue"
                />
                <span>
                  Flujo <strong className="text-ink dark:text-white">general</strong> (sin jerarquía de la organización)
                </span>
              </label>

              {!flujoGeneral && myOrg && (
                <div className="flex items-start gap-2 text-[11px] text-muted dark:text-faint font-body rounded-lg border border-border dark:border-navyCard bg-bg dark:bg-navyDeep p-2.5 mb-3">
                  <Building2 size={13} className="text-blue shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-ink dark:text-white">{myOrg.nombre}</strong>
                    {" · "}
                    <strong className="text-ink dark:text-white">{(myOrg.jerarquia || []).join(", ") || "—"}</strong>
                  </span>
                </div>
              )}

              <button
                onClick={() => handleGenerar()}
                disabled={loading || extractingPdf}
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

              <p className="text-[11px] text-faint font-body mt-2">
                Tip: luego puedes editarlo en "Construir manual".
              </p>
            </>
          ) : (
            <>
              <label className="text-xs font-semibold text-ink dark:text-white font-body mb-2">
                Agrega nodos al lienzo
              </label>
              <div className="grid grid-cols-2 gap-2 mb-3">
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
                className="w-full flex items-center justify-center gap-2 text-xs font-medium text-red border border-red/30 rounded-lg px-3 py-2.5 font-body bg-redSoft dark:bg-red/10 hover:opacity-90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mb-3 cursor-pointer"
              >
                <Trash2 size={13} /> Eliminar seleccionado
              </button>

              <ul className="text-[11px] leading-relaxed text-muted dark:text-faint font-body list-disc pl-4 space-y-1">
                <li>Arrastra entre nodos para conectarlos.</li>
                <li>Doble clic para editar un nodo o conexión.</li>
              </ul>
            </>
          )}

          {error && <p className="text-xs text-red font-body mt-3">{error}</p>}

          {/* Caja AI Insight: colapsada por defecto */}
          {aiResult?.insight && (
            <div className="mt-5 rounded-xl bg-blueSoft dark:bg-blue/15 border border-blue/20 dark:border-blue/30 transition-colors overflow-hidden">
              <button
                type="button"
                onClick={() => setInsightOpen((v) => !v)}
                className="w-full flex items-center justify-between gap-2 p-3 text-left cursor-pointer"
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold text-ink dark:text-white font-body min-w-0">
                  <Lightbulb size={13} className="text-blue dark:text-blue-400 shrink-0" />
                  <span className="truncate">AI Insight</span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-green dark:text-emerald-400 font-semibold font-body whitespace-nowrap">
                    -{aiResult.insight.ahorro_estimado_horas}h
                  </span>
                  <ChevronDown
                    size={14}
                    className={`text-blue dark:text-blue-400 transition-transform ${insightOpen ? "rotate-180" : ""}`}
                  />
                </span>
              </button>

              {insightOpen && (
                <div className="px-3.5 pb-3.5">
                  <p className="text-xs leading-relaxed text-muted dark:text-faint font-body mb-2">
                    <strong className="text-ink dark:text-white">Optimización:</strong> {aiResult.insight.optimizacion}
                  </p>
                  <p className="text-xs leading-relaxed text-muted dark:text-faint font-body mb-2">
                    <strong className="text-ink dark:text-white">Sugerencia:</strong> {aiResult.insight.sugerencia}
                  </p>
                  <p className="text-xs text-green dark:text-emerald-400 font-semibold font-body">
                    Ahorro estimado: {aiResult.insight.ahorro_estimado_horas} horas
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Nombre + Guardar */}
          {hasNodes && (
            <div className="mt-5">
              <p className="text-xs font-semibold text-ink dark:text-white font-body mb-2">Nombre del flujo</p>
              <input
                value={flowName}
                onChange={(e) => {
                  setFlowName(e.target.value);
                  markDirty();
                }}
                placeholder="Nombre del flujo"
                className="w-full text-sm rounded-lg border border-border dark:border-navyCard bg-bg dark:bg-navyDeep p-2.5 text-ink dark:text-white font-body outline-none focus:border-blue mb-3 transition-colors"
              />

              <p className="text-xs font-semibold text-ink dark:text-white font-body mb-2">Guardar flujo</p>
              <button
                onClick={handleGuardar}
                disabled={saving || saved}
                className={`w-full flex items-center justify-center gap-2 text-xs font-semibold text-white rounded-lg px-3 py-2.5 font-body disabled:opacity-70 mb-3 transition-colors cursor-pointer ${
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

              <p className="text-xs font-semibold text-ink dark:text-white font-body mb-2">Generación de documentos</p>
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

              {reportText && reportPdfUrl && (
                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  className="mt-3 w-full flex items-center justify-center gap-2 text-xs font-medium text-blue border border-blue/30 rounded-lg px-3 py-2.5 font-body bg-blueSoft dark:bg-blue/10 hover:opacity-90 transition-colors cursor-pointer"
                >
                  <Eye size={13} /> Ver vista previa del PDF
                </button>
              )}
              {reportText && (
                <p className="mt-3 text-[10px] text-green dark:text-emerald-400 font-body">
                  ✓ Guardado permanentemente — disponible en Reportes → "Insights de IA guardados"
                </p>
              )}
            </div>
          )}
        </div>

        {/* Lienzo React Flow */}
        <div className="flex-1 relative bg-bg dark:bg-navyDeep transition-colors">
          {!hasNodes && !loading && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-sm text-faint font-body text-center px-6">
                El diagrama aparecerá aquí. Generalo con IA o agrega tu primer nodo desde
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
            defaultEdgeOptions={{
              type: "smoothstep",
              style: { stroke: "#3b82f6", strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: "#3b82f6" },
            }}
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

      {/* --- MODAL DE EDICIÓN --- */}
      {editModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-white dark:bg-navy border border-border dark:border-navyCard rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border dark:border-navyCard pb-3">
              <h3 className="text-sm font-bold text-ink dark:text-white flex items-center gap-2 font-display">
                <Edit3 size={16} className="text-blue" />
                {editModal.type === "node" ? "Editar texto del paso" : "Editar etiqueta de conexión"}
              </h3>
              <button
                type="button"
                onClick={() => setEditModal({ isOpen: false, type: null, id: null, label: "" })}
                className="text-muted dark:text-faint hover:text-ink dark:hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted dark:text-faint block mb-1 font-body">
                  {editModal.type === "node"
                    ? "Nombre / Descripción del paso"
                    : 'Etiqueta (ej. "Sí", "No", "Aprobado")'}
                </label>
                <input
                  type="text"
                  autoFocus
                  value={editModal.label}
                  onChange={(e) => setEditModal((prev) => ({ ...prev, label: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border dark:border-navyCard bg-bg dark:bg-navyDeep text-sm text-ink dark:text-white focus:outline-none focus:border-blue font-body"
                  placeholder={editModal.type === "node" ? "Texto del paso..." : "Vacío para sin etiqueta"}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModal({ isOpen: false, type: null, id: null, label: "" })}
                  className="px-4 py-2.5 rounded-xl border border-border dark:border-navyCard text-muted dark:text-faint text-xs font-semibold hover:bg-bg dark:hover:bg-navyDeep transition-colors font-body"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-blue hover:bg-blue/90 text-white text-xs font-semibold shadow-md transition-all font-body"
                >
                  Guardar cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL DE VISTA PREVIA DEL PDF --- */}
      {previewOpen && reportPdfUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Vista previa del reporte PDF"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewOpen(false);
          }}
        >
          <div className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white dark:bg-navy shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-border dark:border-navyCard bg-white dark:bg-navy p-4">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-ink dark:text-white">
                  {flowName.trim() || "Reporte de eficiencia"}
                </h2>
                <p className="text-xs text-muted dark:text-faint">Vista previa del PDF · Informe ejecutivo</p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={handleDescargarPDF}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue px-3 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                >
                  <FileDown size={14} />
                  Descargar PDF
                </button>

                <button
                  onClick={() => setPreviewOpen(false)}
                  aria-label="Cerrar vista previa"
                  className="rounded-lg p-2 text-muted hover:bg-bg dark:text-faint dark:hover:bg-navyDeep"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <iframe title="Vista previa del reporte PDF" src={reportPdfUrl} className="min-h-0 flex-1 bg-slate-100" />
          </div>
        </div>
      )}
    </AppShell>
  );
}