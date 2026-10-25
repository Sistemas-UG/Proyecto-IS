import { useEffect, useState } from "react";
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
  CheckCircle2
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

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [kpis, setKpis] = useState(null);
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  // Normaliza objetos de flujo para asegurar consistencia entre vistas
  const normalizeFlow = (f) => {
    let formattedDate = "Reciente";
    const rawDate = f.fecha || f.created_at || f.createdAt;
    if (rawDate) {
      try {
        const parsed = new Date(rawDate);
        if (!isNaN(parsed.getTime())) {
          formattedDate = parsed.toISOString().split("T")[0];
        }
      } catch (e) {
        formattedDate = "Reciente";
      }
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
      rawTimestamp: rawDate ? new Date(rawDate).getTime() : 0,
      pasos: totalPasos,
      estado: f.estado || f.status || "Activo",
      insight: f.insight || f.diagrama?.insight,
      ahorro_estimado_horas: f.ahorro_estimado_horas
    };
  };

  // --- REGLA Y CÁLCULO DINÁMICO DE KPIS SOBRE TODOS LOS FLUJOS ---
  const calcularKPIs = (flowsList) => {
    const totalFlujos = flowsList.length;
    const completados = flowsList.filter((f) => f.estado === "Completado").length;

    // 1. Suma real del tiempo ahorrado acumulado en horas
    const horasTotales = flowsList.reduce((acc, f) => {
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

    // 2. Score de Optimización
    const scoreCalc = totalFlujos > 0
      ? Math.min(100, Math.round(70 + (completados / totalFlujos) * 20 + Math.min(totalFlujos * 1.5, 10)))
      : 85;

    return {
      flujosActivos: {
        label: "Flujos en sistema",
        value: totalFlujos,
        delta: `${completados} completados / ${totalFlujos - completados} activos`,
      },
      tiempoAhorrado: {
        label: "Tiempo ahorrado total",
        value: `${horasTotales} hrs`,
        delta: `Suma acumulada de ${totalFlujos} flujos`,
      },
      scoreOptimizacion: {
        label: "Score de optimización",
        value: `${scoreCalc}%`,
        delta: totalFlujos > 0 ? `${completados} de ${totalFlujos} procesos eficientes` : "Salud del sistema optima",
      },
    };
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    // Usamos api.getFlows() para traer TODOS los flujos reales de la BD
    Promise.all([api.getKpis(), api.getFlows()])
      .then(([kpisRes, flowsRes]) => {
        if (cancelled) return;
        const rawList = Array.isArray(flowsRes) ? flowsRes : flowsRes?.flows || flowsRes?.data || [];
        const normalized = rawList.map(normalizeFlow);
        
        // Ordenamos por fecha descendente (más recientes primero)
        normalized.sort((a, b) => b.rawTimestamp - a.rawTimestamp);

        setFlows(normalized);
        setKpis(calcularKPIs(normalized));
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, []);

  const handleDelete = async (flow) => {
    if (!window.confirm(`¿Seguro que deseas eliminar el flujo "${flow.nombre}"? Esta acción no se puede deshacer.`)) return;
    setDeletingId(flow.id);
    setError("");
    try {
      await api.deleteFlow(flow.id);
      const updatedList = flows.filter((item) => item.id !== flow.id);
      setFlows(updatedList);
      setKpis(calcularKPIs(updatedList));
    } catch (err) {
      setError(err.message || "No se pudo eliminar el flujo.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AppShell>
      <TopBar
        title={`¡Bienvenido/a, ${user?.username || "usuario"}! 👋`}
        subtitle="Aquí tienes el resumen de la actividad de tus procesos."
      />
      
      <div className="flex-1 overflow-auto p-6 md:p-8 font-body max-w-7xl mx-auto w-full">
        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate-400 font-body mb-6">
            <Loader2 size={14} className="animate-spin text-blue-500" /> Cargando datos actualizados del backend...
          </div>
        )}
        
        {error && <p className="text-sm text-red-500 font-body mb-6">Error: {error}</p>}

        {/* --- TARJETAS DE KPIS --- */}
        {kpis && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
            {Object.entries(kpis).map(([key, k]) => {
              const meta = KPI_META[key] || { label: key, icon: Gauge, tone: "text-blue-500" };
              return (
                <Card key={key} className="p-5 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-sm bg-white dark:bg-[#111827]/90 backdrop-blur-md">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 font-body">{meta.label}</p>
                    <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/60">
                      <meta.icon size={16} className={meta.tone} />
                    </div>
                  </div>
                  <p className={`text-2xl font-bold font-display text-slate-900 dark:text-white`}>{k.value}</p>
                  <p className="text-xs text-slate-400 font-body mt-1">{k.delta}</p>
                </Card>
              );
            })}
          </div>
        )}

        <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formas decorativas de fondo */}
          <div className="absolute -bottom-10 -left-16 w-72 h-72 bg-indigo-500/10 dark:bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -right-10 w-80 h-80 bg-blue-500/10 dark:bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
          {/* --- LISTA DE MIS FLUJOS RECIENTES (Muestra los primeros 5 más recientes del total) --- */}
          <Card className="relative z-10 lg:col-span-2 p-6 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-sm bg-white dark:bg-[#111827]/90 backdrop-blur-md">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold font-display text-slate-900 dark:text-white">Mis Flujos Recientes</h2>
              <Link to="/flujos" className="text-xs font-semibold text-blue-600 dark:text-blue-400 font-body flex items-center gap-1 hover:underline">
                Ver todos ({flows.length}) <ChevronRight size={13} />
              </Link>
            </div>

            <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/60">
              {flows.slice(0, 5).map((f) => (
                <div key={f.id} className="flex items-center justify-between py-3.5 group">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => navigate(`/flujos/${f.id}`)}
                      className="text-left font-body group-hover:text-blue-500 transition-colors cursor-pointer"
                    >
                      <p className="text-sm font-semibold text-slate-900 dark:text-white font-body">{f.nombre}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-body">{f.fecha} · {f.pasos || 0} pasos</p>
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <Pill tone={f.estado === "Completado" ? "blue" : "green"}>
                      {f.estado === "Completado" && <CheckCircle2 size={11} className="inline mr-1" />}
                      {f.estado || "Activo"}
                    </Pill>
                    
                    <button
                      type="button"
                      onClick={() => handleDelete(f)}
                      disabled={deletingId === f.id}
                      title="Eliminar flujo"
                      aria-label={`Eliminar ${f.nombre}`}
                      className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {deletingId === f.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    </button>
                  </div>
                </div>
              ))}

              {!loading && flows.length === 0 && (
                <p className="text-xs text-slate-400 font-body py-6 text-center">Todavía no tienes flujos creados.</p>
              )}
            </div>
          </Card>

          {/* --- TARJETA SUGERENCIA IA --- */}
 <Card className="relative z-10 p-5 overflow-hidden border border-blue-200 dark:border-blue-500/30 shadow-md dark:shadow-xl rounded-2xl bg-gradient-to-br from-blue-50 via-indigo-50 to-white dark:from-slate-900 dark:via-indigo-950 dark:to-slate-900 text-slate-900 dark:text-white flex flex-col justify-between transition-colors">
  <div className="absolute -top-10 -right-10 w-28 h-28 bg-blue-400/10 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

  <div>
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30">
          <Sparkles size={14} />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 font-body">
          IA Insight
        </span>
      </div>
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 font-mono">
        Oportunidad
      </span>
    </div>

    <h3 className="text-xs font-semibold text-slate-900 dark:text-white font-display mb-1.5">
      Cuello de botella en "Revisión de RRHH"
    </h3>
    <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300 font-body mb-3">
      Este paso toma un promedio de <span className="text-amber-600 dark:text-amber-400 font-semibold">72 horas</span>. Automatizar la validación de días con la nómina acelerará el cierre.
    </p>

    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/70 dark:bg-white/5 border border-blue-100 dark:border-white/10 mb-4">
      <div className="flex items-center gap-1.5">
        <Zap size={13} className="text-emerald-600 dark:text-emerald-400" />
        <span className="text-[11px] text-slate-600 dark:text-slate-300 font-body font-medium">Ahorro estimado</span>
      </div>
      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 font-mono bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-500/20">
        -48 horas
      </span>
    </div>
  </div>

  <Link
    to="/flujos/nuevo"
    className="w-full inline-flex items-center justify-center gap-2 text-xs font-semibold text-white rounded-xl px-4 py-2.5 transition-all duration-200 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] shadow-md shadow-blue-600/20 font-body group"
  >
    <span>Optimizar con IA</span>
    <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
  </Link>
</Card>
        </div>
      </div>
    </AppShell>
  );
}