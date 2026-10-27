import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import ReactFlow, { Background, MiniMap, useNodesState, useEdgesState } from "reactflow";
import "reactflow/dist/style.css";
import {
  ArrowLeft,
  Loader2,
  Lightbulb,
  CheckCircle2,
  RotateCcw,
  ListChecks,
  GitBranch,
  Users,
  Zap,
  Play,
  Flag,
  Circle,
  Calendar,
} from "lucide-react";
import AppShell, { TopBar } from "../components/AppShell";
import FlowZoomControls from "../components/FlowZoomControls";
import { Card, Pill } from "../components/ui";
import { api } from "../lib/api";
import { layoutNodes, layoutEdges } from "../lib/flowLayout";
import { touchFlow, setFlowStatus, applyStatusOverrides, parseDateToMs } from "../lib/flowlogic";

// Tamaño de nodo usado por el layout para centrar la cámara
const NODE_W = 200;
const NODE_H = 86;

// Los labels vienen como "Texto del paso (Rol)": separamos el rol
const splitLabel = (label = "") => {
  const m = label.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  return m ? { texto: m[1].trim(), rol: m[2].trim() } : { texto: label.trim(), rol: "" };
};

const formatFecha = (raw) => {
  const ms = parseDateToMs(raw);
  if (!ms) return raw || "Reciente";
  return new Date(ms).toLocaleDateString("es-GT", { day: "numeric", month: "long", year: "numeric" });
};

const TIPO_META = {
  inicio: { icon: Play, label: "Inicio", box: "bg-blueSoft dark:bg-blue/20 text-blue dark:text-blue-400" },
  decision: { icon: GitBranch, label: "Decisión", box: "bg-amberSoft dark:bg-amber/15 text-amber dark:text-amber-400" },
  fin: { icon: Flag, label: "Fin", box: "bg-greenSoft dark:bg-green/20 text-green dark:text-emerald-400" },
  paso: { icon: Circle, label: "Paso", box: "bg-bg dark:bg-navyCard text-muted dark:text-faint" },
};

const StatCard = ({ icon: Icon, label, value }) => (
  <Card className="p-4 flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#111827]/90">
    <div className="w-10 h-10 rounded-xl bg-blueSoft dark:bg-blue/20 flex items-center justify-center shrink-0">
      <Icon size={18} className="text-blue dark:text-blue-400" />
    </div>
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-muted dark:text-faint font-body">{label}</p>
      <p className="text-xl font-bold font-display text-ink dark:text-white leading-tight truncate">{value}</p>
    </div>
  </Card>
);

export default function VerFlujo() {
  const { id } = useParams();
  const [flow, setFlow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [estado, setEstado] = useState("Activo");
  const [updating, setUpdating] = useState(false);
  const [rf, setRf] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api
      .getFlow(id)
      .then((data) => {
        if (!active) return;
        setFlow(data.flow);
        const [withOverride] = applyStatusOverrides([{ id, estado: data.flow?.estado || "Activo" }]);
        setEstado(withOverride.estado);
        if (data.flow?.nodes?.length) {
          setNodes(layoutNodes(data.flow.nodes, data.flow.edges || []));
          setEdges(layoutEdges(data.flow.edges || []));
        }
        touchFlow(id); // Abrir el flujo cuenta como atenderlo
      })
      .catch((err) => active && setError(err.message || "No se pudo cargar el flujo."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id, setNodes, setEdges]);

  // Pasos ordenados de arriba hacia abajo según el layout
  const steps = useMemo(() => {
    const raw = flow?.nodes || [];
    return [...nodes]
      .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
      .map((n, i) => {
        const original = raw.find((r) => String(r.id) === String(n.id));
        const { texto, rol } = splitLabel(n.data?.label);
        return {
          id: n.id,
          n: i + 1,
          texto,
          rol,
          tipo: original?.type || n.data?.tipo || "paso",
          x: n.position.x,
          y: n.position.y,
        };
      });
  }, [nodes, flow]);

  // Cálculo dinámico optimizado de métricas y Ahorro Estimado (IA)
  const stats = useMemo(() => {
    const rawNodes = flow?.nodes || flow?.nodos || [];
    const totalPasos = steps.length || rawNodes.length || flow?.pasos || 0;

    // Conteo de decisiones
    const decisionesCount = steps.filter(
      (s) => s.tipo === "decision" || s.tipo === "decisión" || s.texto?.includes("?")
    ).length;

    // Extracción limpia de roles
    const rolesSet = new Set();
    steps.forEach((s) => {
      if (s.rol) rolesSet.add(s.rol);
    });
    rawNodes.forEach((n) => {
      const r = n.rol || n.role || n.responsable || n.data?.rol;
      if (r) rolesSet.add(r);
    });
    if (Array.isArray(flow?.roles)) {
      flow.roles.forEach((r) => rolesSet.add(r));
    }

    const rolesCount = rolesSet.size > 0 ? rolesSet.size : 1;

    // Ahorro Estimado (Soporta múltiples fuentes de IA + Algoritmo fallback)
    let ahorroHoras = 0;
    if (typeof flow?.aiInsight === "object" && flow?.aiInsight?.ahorro_estimado_horas) {
      ahorroHoras = Number(flow.aiInsight.ahorro_estimado_horas) || 0;
    } else if (typeof flow?.insight === "object" && flow?.insight?.ahorro_estimado_horas) {
      ahorroHoras = Number(flow.insight.ahorro_estimado_horas) || 0;
    } else if (flow?.ahorro_estimado_horas) {
      ahorroHoras = Number(flow.ahorro_estimado_horas) || 0;
    } else {
      ahorroHoras = Math.max(2, Math.round((totalPasos || 4) * 0.8));
    }

    return {
      pasos: totalPasos,
      decisiones: decisionesCount,
      roles: rolesCount,
      ahorro: `${ahorroHoras} hrs`,
    };
  }, [steps, flow]);

  const completado = estado === "Completado";

  const handleToggleStatus = async () => {
    const nuevo = completado ? "Activo" : "Completado";
    setEstado(nuevo);
    touchFlow(id);
    setFlowStatus(id, nuevo);
    setUpdating(true);
    try {
      if (typeof api.updateFlow === "function") {
        await api.updateFlow(id, { estado: nuevo });
      } else if (typeof api.updateFlowStatus === "function") {
        await api.updateFlowStatus(id, nuevo);
      }
    } catch (err) {
      console.warn("No se pudo guardar el estado en el backend (se mantiene localmente):", err);
    } finally {
      setUpdating(false);
    }
  };

  // Centra el diagrama en el paso elegido
  const focusStep = (s) => {
    setSelectedId(s.id);
    if (rf) rf.setCenter(s.x + NODE_W / 2, s.y + NODE_H / 2, { zoom: 1.1, duration: 600 });
  };

  // Resalta el nodo seleccionado
  const displayNodes = useMemo(
    () =>
      nodes.map((n) =>
        n.id === selectedId
          ? { ...n, className: `${n.className} ring-2 ring-blue ring-offset-2 ring-offset-transparent` }
          : n
      ),
    [nodes, selectedId]
  );

  return (
    <AppShell>
      <TopBar title={flow?.nombre || "Flujo"} subtitle="Vista de solo consulta" />

      <div className="flex-1 overflow-auto p-6 md:p-8 w-full max-w-7xl mx-auto font-body">
        <Link
          to="/flujos"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted dark:text-faint hover:text-blue dark:hover:text-blue-400 mb-5 px-3 py-2 rounded-xl border border-border dark:border-navyCard bg-white dark:bg-navy hover:border-blue/40 transition-colors"
        >
          <ArrowLeft size={14} /> Volver a Mis Flujos
        </Link>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted dark:text-faint font-body">
            <Loader2 size={16} className="animate-spin text-blue" /> Cargando flujo…
          </div>
        ) : error ? (
          <p role="alert" className="rounded-xl border border-red/20 bg-redSoft dark:bg-red/10 p-3 text-sm text-red">
            {error}
          </p>
        ) : (
          <>
            {/* ============ CABECERA ============ */}
            <Card className="p-5 rounded-2xl mb-5">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <Pill tone={completado ? "blue" : "green"}>
                      {completado && <CheckCircle2 size={11} className="inline mr-1" />}
                      {estado}
                    </Pill>
                    {flow?.tipo && (
                      <Pill tone={flow.tipo === "especifico" ? "blue" : "gray"}>
                        {flow.tipo === "especifico" ? "Específico de tu organización" : "Flujo general"}
                      </Pill>
                    )}
                  </div>
                  <h2 className="text-xl font-bold font-display text-ink dark:text-white leading-tight truncate">
                    {flow?.nombre}
                  </h2>
                  <p className="flex items-center gap-1.5 text-xs text-muted dark:text-faint font-body mt-1">
                    <Calendar size={12} /> Creado el {formatFecha(flow?.fecha)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleToggleStatus}
                  disabled={updating}
                  className={`flex items-center justify-center gap-2 text-xs font-semibold rounded-xl px-4 py-2.5 transition-all cursor-pointer active:scale-[0.98] disabled:opacity-60 ${
                    completado
                      ? "border border-border dark:border-navyCard text-ink dark:text-white hover:bg-bg dark:hover:bg-navyCard"
                      : "bg-blue text-white shadow-md shadow-blue/20 hover:opacity-90"
                  }`}
                >
                  {updating ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : completado ? (
                    <RotateCcw size={14} />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  {completado ? "Reactivar flujo" : "Marcar como completado"}
                </button>
              </div>
            </Card>

            {/* ============ RESUMEN KPIS ============ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
              <StatCard icon={ListChecks} label="Pasos" value={stats.pasos} />
              <StatCard icon={GitBranch} label="Decisiones" value={stats.decisiones} />
              <StatCard icon={Users} label="Roles" value={stats.roles} />
              <StatCard icon={Zap} label="Ahorro estimado" value={stats.ahorro} />
            </div>

            {/* ============ DIAGRAMA + PASOS ============ */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 mb-5 items-start">
              <Card className="h-[640px] overflow-hidden rounded-2xl">
                <ReactFlow
                  nodes={displayNodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onInit={setRf}
                  nodesDraggable={false}
                  nodesConnectable={false}
                  elementsSelectable={false}
                  fitView
                  fitViewOptions={{ padding: 0.12, minZoom: 0.5, maxZoom: 1.1 }}
                  minZoom={0.2}
                  proOptions={{ hideAttribution: true }}
                >
                  <Background gap={22} size={1} color="rgba(148,163,184,0.25)" />
                  <FlowZoomControls />
                  <MiniMap
                    pannable
                    zoomable
                    maskColor="rgba(91,95,239,0.08)"
                    nodeColor="#8B5CF6"
                    nodeStrokeWidth={0}
                    className="!rounded-xl !border !border-border dark:!border-navyCard !bg-white dark:!bg-navy"
                  />
                </ReactFlow>
              </Card>

              <Card className="rounded-2xl overflow-hidden flex flex-col h-[640px]">
                <div className="px-4 py-3.5 border-b border-border dark:border-navyCard flex items-center justify-between">
                  <h3 className="text-sm font-semibold font-display text-ink dark:text-white">Pasos del flujo</h3>
                  <span className="text-[11px] font-semibold text-blue dark:text-blue-400 bg-blueSoft dark:bg-blue/20 px-2 py-0.5 rounded-full">
                    {steps.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                  {steps.length === 0 ? (
                    <p className="text-xs text-muted dark:text-faint text-center py-8">Este flujo no tiene pasos.</p>
                  ) : (
                    steps.map((s) => {
                      const meta = TIPO_META[s.tipo] || TIPO_META.paso;
                      const Icon = meta.icon;
                      const active = selectedId === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => focusStep(s)}
                          className={`w-full flex items-start gap-3 p-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                            active ? "bg-blueSoft dark:bg-blue/15" : "hover:bg-bg dark:hover:bg-navyCard/60"
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta.box}`}>
                            <Icon size={14} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-ink dark:text-white leading-snug">
                              <span className="text-muted dark:text-faint mr-1">{s.n}.</span>
                              {s.texto}
                            </p>
                            {s.rol && (
                              <span className="inline-block mt-1 text-[10px] font-medium text-muted dark:text-faint bg-bg dark:bg-navyDeep border border-border dark:border-navyCard rounded-full px-2 py-0.5">
                                {s.rol}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </Card>
            </div>

            {/* ============ INSIGHT DE IA ============ */}
            {(flow?.aiInsight || flow?.insight) && (
              <Card className="p-5 rounded-2xl border border-amber/30">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-amberSoft dark:bg-amber/15 flex items-center justify-center shrink-0">
                    <Lightbulb size={16} className="text-amber dark:text-amber-400" />
                  </div>
                  <h3 className="text-sm font-semibold font-display text-ink dark:text-white">Insight de la IA</h3>
                </div>
                <p className="text-sm text-muted dark:text-slate-300 font-body leading-relaxed">
                  {flow.aiInsight?.sugerencia ||
                    flow.aiInsight?.optimizacion ||
                    flow.insight?.sugerencia ||
                    flow.insight?.optimizacion}
                </p>
              </Card>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}