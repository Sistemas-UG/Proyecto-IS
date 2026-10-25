import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Sparkles,
  TrendingUp,
  Clock,
  Gauge,
  ChevronRight,
  Loader2,
  Trash2,
  Zap,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react";
import AppShell, { TopBar } from "../components/AppShell";
import { Card, Pill } from "../components/ui";
import { useAuth } from "../lib/AuthContext";
import { api } from "../lib/api";

const KPI_META = {
  flujosActivos: { label: "Flujos en sistema", icon: Gauge, tone: "text-blue-500" },
  tiempoAhorrado: { label: "Tiempo ahorrado total", icon: Clock, tone: "text-emerald-500" },
  scoreOptimizacion: { label: "Score de optimización", icon: TrendingUp, tone: "text-amber-500" },
};

const MS_POR_DIA = 1000 * 60 * 60 * 24;
const DIAS_PARA_ALERTA = 7;

// Conversor universal de fechas a milisegundos (Soporta ISO, YYYY-MM-DD y DD/MM/YYYY)
const parseDateToMs = (dateStr) => {
  if (!dateStr) return 0;
  if (typeof dateStr === "number") return dateStr;

  let parsed = new Date(dateStr).getTime();
  if (!isNaN(parsed) && parsed > 0) return parsed;

  if (typeof dateStr === "string" && dateStr.includes("/")) {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const isoFormatted = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
      parsed = new Date(isoFormatted).getTime();
      if (!isNaN(parsed)) return parsed;
    }
  }
  return 0;
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // --- PERSISTENCIA LOCAL DE SESIÓN ---
  const [flows, setFlows] = useState(() => {
    try {
      const saved = localStorage.getItem("smartflow_cached_flows");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [loading, setLoading] = useState(() => flows.length === 0);
  const [error, setError] = useState("");
  
  // Estado para el modal de eliminación
  const [flowToDelete, setFlowToDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Normaliza objetos de flujo
  const normalizeFlow = (f) => {
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
      try { stepsData = JSON.parse(stepsData); } catch (e) { stepsData = []; }
    }
    if (!Array.isArray(stepsData) && typeof stepsData === "object" && stepsData !== null) {
      stepsData = stepsData.nodes || stepsData.pasos || stepsData.steps || [];
    }

    const totalPasos = Array.isArray(stepsData)
      ? stepsData.length
      : (typeof f.pasos === "number" ? f.pasos : 0);

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

  // --- ALGORITMO Y CÁLCULO DE KPIS ---
  const kpis = useMemo(() => {
    const totalFlujos = flows.length;
    const completados = flows.filter((f) => f.estado === "Completado").length;
    const activos = totalFlujos - completados;

    const horasTotales = flows.reduce((acc, f) => {
      let horas = 0;
      if (typeof f.insight === "object" && f.insight?.ahorro_estimado_horas) {
        horas = Number(f.insight.ahorro_estimado_horas) || 0;
      } else if (f.ahorro_estimado_horas) {
        horas = Number(f.ahorro_estimado_horas) || 0;
      } else {
        horas = Math.max(2, Math.round((f.pasos || 4) * 0.8));
      }
      return acc + horas;
    }, 0);

    const flujosConInsight = flows.filter(
      (f) => f.estado === "Completado" || f.insight || f.ahorro_estimado_horas > 0
    ).length;

    let scoreCalc = 100;
    if (totalFlujos > 0) {
      const ratioCompletados = completados / totalFlujos;
      const ratioInsights = flujosConInsight / totalFlujos;
      scoreCalc = Math.round(20 + ratioCompletados * 40 + ratioInsights * 40);
      scoreCalc = Math.min(100, Math.max(10, scoreCalc));
    }

    return {
      flujosActivos: {
        label: "Flujos en sistema",
        value: totalFlujos,
        delta: `${completados} completados / ${activos} activos`,
      },
      tiempoAhorrado: {
        label: "Tiempo ahorrado total",
        value: `${horasTotales} hrs`,
        delta: `Suma acumulada de ${totalFlujos} flujos`,
      },
      scoreOptimizacion: {
        label: "Score de optimización",
        value: `${scoreCalc}%`,
        delta: totalFlujos > 0 ? `${flujosConInsight} de ${totalFlujos} procesos eficientes` : "Salud del sistema óptima",
      },
    };
  }, [flows]);

  useEffect(() => {
    let cancelled = false;
    if (flows.length === 0) setLoading(true);
    setError("");

    api
      .getFlows()
      .then((flowsRes) => {
        if (cancelled) return;
        const rawList = Array.isArray(flowsRes) ? flowsRes : flowsRes?.flows || flowsRes?.data || [];
        const normalized = rawList.map(normalizeFlow);
        normalized.sort((a, b) => b.rawTimestamp - a.rawTimestamp);

        setFlows(normalized);
        localStorage.setItem("smartflow_cached_flows", JSON.stringify(normalized));
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, []);

  // --- ELIMINACIÓN DESDE EL MODAL ---
  const confirmDelete = async () => {
    if (!flowToDelete) return;
    setDeletingId(flowToDelete.id);
    setError("");
    try {
      await api.deleteFlow(flowToDelete.id);
      const updatedList = flows.filter((item) => item.id !== flowToDelete.id);
      setFlows(updatedList);
      localStorage.setItem("smartflow_cached_flows", JSON.stringify(updatedList));
      setFlowToDelete(null);
    } catch (err) {
      setError(err.message || "No se pudo eliminar el flujo.");
    } finally {
      setDeletingId(null);
    }
  };

  // --- FLUJOS QUE NECESITAN ATENCIÓN ---
  const flujosAtencion = useMemo(() => {
    const ahora = Date.now();
    return flows
      .filter((f) => f.estado === "Activo")
      .map((f) => {
        const msDiferencia = f.rawTimestamp > 0 ? ahora - f.rawTimestamp : 0;
        const dias = Math.max(0, Math.floor(msDiferencia / MS_POR_DIA));
        return {
          ...f,
          diasActivo: dias,
        };
      })
      .sort((a, b) => {
        if (b.diasActivo !== a.diasActivo) {
          return b.diasActivo - a.diasActivo;
        }
        return b.pasos - a.pasos;
      })
      .slice(0, 3);
  }, [flows]);

  const textoDiasActivo = (dias) => {
    if (dias === 0) return "Activo desde hoy";
    if (dias === 1) return "Activo hace 1 día";
    return `Activo hace ${dias} días`;
  };

  return (
    <AppShell>
      <TopBar
        title={`¡Bienvenido/a, ${user?.username || user?.name || "usuario"}! 👋`}
        subtitle="Aquí tienes el resumen de la actividad de tus procesos."
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-7xl mx-auto w-full font-body box-border">
        {loading && flows.length === 0 && (
          <div className="flex items-center gap-2 text-xs text-slate-400 font-body mb-3">
            <Loader2 size={14} className="animate-spin text-blue-500" /> Sincronizando datos del backend...
          </div>
        )}

        {error && <p className="text-xs text-red-500 font-body mb-3">Error: {error}</p>}

        {/* --- TARJETAS DE KPIS --- */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          {Object.entries(kpis).map(([key, k]) => {
            const meta = KPI_META[key] || { label: key, icon: Gauge, tone: "text-blue-500" };
            return (
              <Card key={key} className="p-4 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-sm bg-white dark:bg-[#111827]/90 backdrop-blur-md">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 font-body">{meta.label}</p>
                  <div className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/60">
                    <meta.icon size={15} className={meta.tone} />
                  </div>
                </div>
                <p className="text-2xl font-bold font-display text-slate-900 dark:text-white">{k.value}</p>
                <p className="text-[10px] text-slate-400 font-body mt-0.5">{k.delta}</p>
              </Card>
            );
          })}
        </div>

        {/* --- SECCIÓN PRINCIPAL (8 FLUJOS RECIENTES + COLUMNA DERECHA) --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          {/* COLUMNA IZQUIERDA: Mis Flujos Recientes (Muestra los 8 más recientes) */}
          <Card className="lg:col-span-2 p-5 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-sm bg-white dark:bg-[#111827]/90 backdrop-blur-md flex flex-col">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800/60 pb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white font-display">
                Mis Flujos Recientes
              </h2>
              <Link to="/flujos" className="text-xs font-semibold text-blue-600 dark:text-blue-400 font-body flex items-center gap-1 hover:underline">
                Ver todos ({flows.length}) <ChevronRight size={13} />
              </Link>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {flows.slice(0, 8).map((f) => (
                <div key={f.id} className="flex items-center justify-between py-2.5 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 px-1 rounded-lg transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => navigate(`/flujos/${f.id}`)}
                      className="text-left font-body group-hover:text-blue-500 transition-colors cursor-pointer truncate"
                    >
                      <p className="text-xs font-semibold text-slate-900 dark:text-white font-body truncate">{f.nombre}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-body">{f.fecha} · {f.pasos || 0} pasos</p>
                    </button>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Pill tone={f.estado === "Completado" ? "blue" : "green"}>
                      {f.estado === "Completado" && <CheckCircle2 size={10} className="inline mr-1" />}
                      {f.estado || "Activo"}
                    </Pill>

                    {/* Botón basurero abre el modal */}
                    <button
                      type="button"
                      onClick={() => setFlowToDelete(f)}
                      title="Eliminar flujo"
                      aria-label={`Eliminar ${f.nombre}`}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}

              {!loading && flows.length === 0 && (
                <p className="text-xs text-slate-400 font-body py-8 text-center">Todavía no tienes flujos creados.</p>
              )}
            </div>
          </Card>

          {/* COLUMNA DERECHA: IA Insight + Flujos que necesitan atención */}
          <div className="flex flex-col gap-5">
            {/* TARJETA SUGERENCIA IA */}
            <Card className="relative p-4 overflow-hidden border border-blue-200 dark:border-blue-500/30 shadow-sm rounded-2xl bg-gradient-to-br from-blue-50 via-indigo-50 to-white dark:from-slate-900 dark:via-indigo-950 dark:to-slate-900 text-slate-900 dark:text-white flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className="p-1 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30">
                      <Sparkles size={13} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 font-body">
                      IA Insight
                    </span>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 font-mono">
                    Oportunidad
                  </span>
                </div>

                <h3 className="text-xs font-semibold text-slate-900 dark:text-white font-display mb-1">
                  Cuello de botella en "Revisión de RRHH"
                </h3>
                <p className="text-[10px] leading-relaxed text-slate-600 dark:text-slate-300 font-body mb-2.5">
                  Este paso toma un promedio de <span className="text-amber-600 dark:text-amber-400 font-semibold">72 horas</span>. Automatizar la validación acelerará el cierre.
                </p>

                <div className="flex items-center justify-between p-2 rounded-xl bg-white/70 dark:bg-white/5 border border-blue-100 dark:border-white/10 mb-3">
                  <div className="flex items-center gap-1.5">
                    <Zap size={12} className="text-emerald-600 dark:text-emerald-400" />
                    <span className="text-[10px] text-slate-600 dark:text-slate-300 font-body font-medium">Ahorro estimado</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 font-mono bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-500/20">
                    -48 horas
                  </span>
                </div>
              </div>

              <Link
                to="/flujos/nuevo"
                className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white rounded-xl px-3 py-2 transition-all duration-200 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] shadow-sm font-body group"
              >
                <span>Optimizar con IA</span>
                <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </Card>

            {/* TARJETA FLUJOS QUE NECESITAN ATENCIÓN */}
            <Card className="p-4 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-sm bg-white dark:bg-[#111827]/90 backdrop-blur-md flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <div className="p-1 rounded-lg bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">
                    <Clock size={13} />
                  </div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white font-display">
                    Flujos que necesitan atención
                  </h2>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-body mb-2">
                  Procesos activos con mayor tiempo pendiente.
                </p>

                {flujosAtencion.length > 0 ? (
                  <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/60">
                    {flujosAtencion.map((f) => {
                      const esAlerta = f.diasActivo >= DIAS_PARA_ALERTA;
                      return (
                        <div key={f.id} className="flex items-center justify-between gap-2 py-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-900 dark:text-white font-body truncate">
                              {f.nombre}
                            </p>
                            <div className="flex items-center gap-1 mt-0.5">
                              {esAlerta && <AlertTriangle size={10} className="text-amber-500 shrink-0" />}
                              <p className={`text-[10px] font-body ${esAlerta ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-slate-500 dark:text-slate-400"}`}>
                                {textoDiasActivo(f.diasActivo)}
                              </p>
                            </div>
                          </div>
                          <Link
                            to={`/flujos/${f.id}`}
                            className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 rounded-lg px-2 py-1 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors font-body group"
                          >
                            Revisar
                            <ArrowRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 font-body py-2">
                    <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                    {loading ? "Calculando..." : "Todo al día: no hay flujos pendientes de revisión."}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* --- MODAL DE ELIMINACIÓN DE FLUJO --- */}
      {flowToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deletingId) setFlowToDelete(null);
          }}
        >
          <div className="w-full max-w-md bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-900 dark:text-white font-body relative animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setFlowToDelete(null)}
              disabled={deletingId === flowToDelete.id}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold font-display text-slate-900 dark:text-white">
                  Eliminar flujo
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-body">
                  Confirmación de borrado permanente
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 font-body leading-relaxed mb-6">
              ¿Seguro que quieres eliminar <strong className="font-semibold text-slate-900 dark:text-white">"{flowToDelete.nombre}"</strong>? Esta acción no se puede deshacer y el flujo se borrará de la base de datos.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => setFlowToDelete(null)}
                disabled={deletingId === flowToDelete.id}
                className="px-4 py-2.5 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={confirmDelete}
                disabled={deletingId === flowToDelete.id}
                className="px-5 py-2.5 text-xs font-bold rounded-xl text-white transition-all shadow-md shadow-red-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 hover:opacity-90 active:scale-95"
                style={{ backgroundColor: "#dc2626", color: "#ffffff" }}
              >
                {deletingId === flowToDelete.id ? (
                  <>
                    <Loader2 size={14} className="animate-spin text-white" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <span>Eliminar</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}