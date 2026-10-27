import { useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  Loader2,
  FileDown,
  Clock,
  TrendingUp,
  Search,
  Inbox,
  X,
  Eye,
  Zap,
} from "lucide-react";
import AppShell, { TopBar } from "../components/AppShell";
import { api } from "../lib/api";
import { crearReportePDF } from "../lib/reportPdf";

export default function Reportes() {
  const [insights, setInsights] = useState([]);
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState(null);
  const [generandoId, setGenerandoId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError("");

    // Consultamos tanto reportes como la lista total de flujos para alinear métricas
    Promise.all([api.getInsights(), api.getFlows()])
      .then(([resInsights, resFlows]) => {
        if (cancelled) return;
        setInsights(resInsights.insights || []);

        const rawFlows = Array.isArray(resFlows) ? resFlows : resFlows?.flows || resFlows?.data || [];
        setFlows(rawFlows);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "No se pudieron cargar los reportes.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return insights;

    const q = query.trim().toLowerCase();

    return insights.filter((i) => (i.titulo || "").toLowerCase().includes(q));
  }, [insights, query]);

  // --- CÁLCULO SINCRONIZADO DE HORAS (IGUAL QUE EN EL DASHBOARD) ---
  const totalHoras = useMemo(() => {
    if (!flows.length) {
      return insights.reduce((acc, i) => acc + (Number(i.ahorroEstimadoHoras ?? i.ahorro_estimado_horas) || 0), 0);
    }

    return flows.reduce((acc, f) => {
      let horas = 0;
      if (typeof f.insight === "object" && f.insight?.ahorro_estimado_horas) {
        horas = Number(f.insight.ahorro_estimado_horas) || 0;
      } else if (f.ahorro_estimado_horas) {
        horas = Number(f.ahorro_estimado_horas) || 0;
      } else {
        let stepsCount = 0;
        let stepsData = f.pasos || f.nodes || f.steps || f.diagrama?.nodes || f.pasos_json || [];
        if (typeof stepsData === "string") {
          try {
            stepsData = JSON.parse(stepsData);
          } catch (e) {
            stepsData = [];
          }
        }
        if (Array.isArray(stepsData)) stepsCount = stepsData.length;
        else if (typeof f.pasos === "number") stepsCount = f.pasos;

        horas = Math.max(2, Math.round((stepsCount || 4) * 0.8));
      }
      return acc + horas;
    }, 0);
  }, [flows, insights]);

  const promedioHoras = useMemo(() => {
    const totalCount = flows.length || insights.length;
    if (!totalCount) return 0;
    return (totalHoras / totalCount).toFixed(1);
  }, [flows, insights, totalHoras]);

  const ultimo = useMemo(() => {
    if (!insights.length) return null;

    return [...insights].sort((a, b) => {
      const fechaA = new Date(a.generatedEn || a.created_at || 0).getTime();
      const fechaB = new Date(b.generatedEn || b.created_at || 0).getTime();
      return fechaB - fechaA;
    })[0];
  }, [insights]);

  // El PDF lo arma el generador compartido (lib/reportPdf.js), el mismo que usa
  // Crear Flujo, así el usuario ve exactamente lo mismo en ambos lados.
  // Si el reporte está ligado a un flujo guardado, se dibuja el diagrama al final.
  const previsualizarPDF = async (insight) => {
    setGenerandoId(insight.id);

    let flow = null;
    const flujoId = insight.flujoId ?? insight.flujo_id;
    if (flujoId) {
      try {
        const res = await api.getFlow(flujoId);
        if (res?.flow?.nodes?.length) flow = { nodes: res.flow.nodes, edges: res.flow.edges || [] };
      } catch {
        // Si el flujo ya no existe o no se puede leer, el PDF sale sin diagrama.
      }
    }

    const { blob, filename } = crearReportePDF({
      titulo: insight.titulo || "Flujo sin nombre",
      texto: insight.reporteTexto,
      generatedEn: insight.generatedEn,
      ahorroHoras: insight.ahorroEstimadoHoras ?? insight.ahorro_estimado_horas,
      flow,
    });
    const url = URL.createObjectURL(blob);

    setPreview((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return { url, filename, titulo: insight.titulo || "Reporte de eficiencia" };
    });
    setGenerandoId(null);
  };

  const descargarPDF = () => {
    if (!preview) return;

    const link = document.createElement("a");
    link.href = preview.url;
    link.download = preview.filename;

    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview?.url]);

  return (
    <AppShell>
      <TopBar
        title="Reportes"
        subtitle="Reportes de eficiencia generados por IA a partir de tus flujos, guardados automáticamente."
      />

      <div className="flex-1 overflow-auto p-6 md:p-8 w-full max-w-6xl mx-auto font-body">
        {/* --- TARJETAS DE RESUMEN EJECUTIVO (4 COLUMNAS) --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Card 1: Reportes Generados */}
          <div className="bg-white dark:bg-navy border border-border dark:border-navyCard rounded-2xl p-5 shadow-sm transition-all hover:border-blue/40">
            <div className="flex items-center gap-2 text-muted dark:text-faint text-xs font-semibold font-body mb-2">
              <Sparkles size={14} className="text-blue" />
              Reportes generados
            </div>
            <p className="text-2xl font-bold font-display text-ink dark:text-white">{insights.length}</p>
            <p className="text-[11px] text-muted dark:text-faint mt-1 font-body">Almacenados en el sistema</p>
          </div>

          {/* Card 2: Horas Ahorradas Totales */}
          <div className="bg-white dark:bg-navy border border-border dark:border-navyCard rounded-2xl p-5 shadow-sm transition-all hover:border-emerald-500/40">
            <div className="flex items-center gap-2 text-muted dark:text-faint text-xs font-semibold font-body mb-2">
              <TrendingUp size={14} className="text-emerald-500" />
              Horas ahorradas totales
            </div>
            <p className="text-2xl font-bold font-display text-ink dark:text-white">{totalHoras} hrs</p>
            <p className="text-[11px] text-emerald-500 font-medium mt-1 font-body">
              Suma acumulada de {flows.length} flujos
            </p>
          </div>

          {/* Card 3: Promedio por proceso */}
          <div className="bg-white dark:bg-navy border border-border dark:border-navyCard rounded-2xl p-5 shadow-sm transition-all hover:border-amber-500/40">
            <div className="flex items-center gap-2 text-muted dark:text-faint text-xs font-semibold font-body mb-2">
              <Zap size={14} className="text-amber-500" />
              Promedio por proceso
            </div>
            <p className="text-2xl font-bold font-display text-ink dark:text-white">{promedioHoras} hrs</p>
            <p className="text-[11px] text-muted dark:text-faint mt-1 font-body">Ahorro estimado medio</p>
          </div>

          {/* Card 4: Último generado */}
          <div className="bg-white dark:bg-navy border border-border dark:border-navyCard rounded-2xl p-5 shadow-sm transition-all hover:border-indigo-500/40">
            <div className="flex items-center gap-2 text-muted dark:text-faint text-xs font-semibold font-body mb-2">
              <Clock size={14} className="text-indigo-500" />
              Último generado
            </div>
            <p className="text-sm font-bold text-ink dark:text-white truncate mt-1">
              {ultimo
                ? new Date(ultimo.generatedEn || ultimo.created_at || Date.now()).toLocaleDateString("es-GT")
                : "—"}
            </p>
            <p className="text-[11px] text-muted dark:text-faint truncate mt-1 font-body">
              {ultimo ? ultimo.titulo || "Flujo sin nombre" : "Sin actividad reciente"}
            </p>
          </div>
        </div>

        {/* Buscador */}
        <div className="relative mb-6">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar reporte por nombre del flujo…"
            className="w-full text-sm rounded-xl border border-border dark:border-navyCard bg-white dark:bg-navy pl-10 pr-4 py-3 text-ink dark:text-white font-body outline-none focus:border-blue transition-colors placeholder:text-muted/60 dark:placeholder:text-faint/50"
          />
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted dark:text-faint font-body">
            <Loader2 size={16} className="animate-spin text-blue" />
            Cargando reportes de eficiencia…
          </div>
        )}

        {!loading && error && <p className="text-sm text-red font-body py-10 text-center">{error}</p>}

        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-16 px-4 space-y-3 max-w-md mx-auto">
            <div className="w-20 h-20 bg-bg dark:bg-navyDeep border border-border dark:border-navyCard rounded-3xl flex items-center justify-center mx-auto text-faint shadow-inner">
              <Inbox size={34} strokeWidth={1.2} />
            </div>

            <h3 className="text-sm font-bold text-ink dark:text-white font-body">
              {insights.length === 0 ? "Todavía no hay reportes" : "Sin resultados"}
            </h3>

            <p className="text-xs text-muted dark:text-faint leading-relaxed font-body">
              {insights.length === 0
                ? 'Ve a "Crear Flujo", genera tu diagrama y pulsa "Reporte de Eficiencia (con IA)". El reporte quedará guardado aquí.'
                : "Prueba con otro término de búsqueda."}
            </p>
          </div>
        )}

        {/* Modal de vista previa */}
        {preview && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label="Vista previa del reporte PDF"
            onClick={(e) => {
              if (e.target === e.currentTarget) setPreview(null);
            }}
          >
            <div className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white dark:bg-navy shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-border dark:border-navyCard bg-white dark:bg-navy p-4">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-ink dark:text-white">{preview.titulo}</h2>
                  <p className="text-xs text-muted dark:text-faint">Vista previa del PDF · Informe ejecutivo</p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={descargarPDF}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue px-3 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                  >
                    <FileDown size={14} />
                    Descargar PDF
                  </button>

                  <button
                    onClick={() => setPreview(null)}
                    aria-label="Cerrar vista previa"
                    className="rounded-lg p-2 text-muted hover:bg-bg dark:text-faint dark:hover:bg-navyDeep"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <iframe title={`Vista previa ${preview.titulo}`} src={preview.url} className="min-h-0 flex-1 bg-slate-100" />
            </div>
          </div>
        )}

        {/* Lista de reportes */}
        {!loading && !error && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((insight) => {
              const ahorroVal = insight.ahorroEstimadoHoras ?? insight.ahorro_estimado_horas;

              return (
                <div
                  key={insight.id}
                  className="rounded-2xl border border-border dark:border-navyCard bg-white dark:bg-navy overflow-hidden transition-colors"
                >
                  <div className="flex items-center justify-between gap-3 px-5 py-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink dark:text-white truncate">
                        {insight.titulo || "Flujo sin nombre"}
                      </p>

                      <p className="text-[11px] text-muted dark:text-faint">
                        {insight.generatedEn
                          ? new Date(insight.generatedEn).toLocaleString("es-GT")
                          : "Fecha no disponible"}

                        {ahorroVal != null && ` · Ahorro estimado: ${ahorroVal}h`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => previsualizarPDF(insight)}
                        disabled={generandoId === insight.id}
                        title="Vista previa del PDF"
                        className="flex items-center gap-1.5 disabled:opacity-70 text-xs font-medium text-ink dark:text-white border border-border dark:border-navyCard rounded-lg px-3 py-2 font-body bg-bg dark:bg-navyDeep hover:border-blue transition-colors cursor-pointer"
                      >
                        {generandoId === insight.id ? (
                          <Loader2 size={13} className="animate-spin text-blue" />
                        ) : (
                          <Eye size={13} className="text-blue" />
                        )}
                        <span className="hidden sm:inline">Vista previa</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}