import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PlusCircle, Sparkles, TrendingUp, Clock, Gauge, ChevronRight, Loader2, Trash2 } from "lucide-react";
import AppShell, { TopBar } from "../components/AppShell";
import { Card, Pill } from "../components/ui";
import { useAuth } from "../lib/AuthContext";
import { api } from "../lib/api";

const KPI_META = {
  flujosActivos: { label: "Flujos activos", icon: Gauge, tone: "text-blue" },
  tiempoAhorrado: { label: "Tiempo ahorrado", icon: Clock, tone: "text-green" },
  scoreOptimizacion: { label: "Score de optimización", icon: TrendingUp, tone: "text-amber" },
};

export default function Dashboard() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState(null);
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    Promise.all([api.getKpis(), api.getRecentFlows()])
      .then(([kpisRes, flowsRes]) => {
        if (cancelled) return;
        setKpis(kpisRes.kpis);
        setFlows(flowsRes.flows);
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
      setFlows((current) => current.filter((item) => item.id !== flow.id));
      setKpis((current) => current ? { ...current, flujosActivos: current.flujosActivos ? { ...current.flujosActivos, value: Math.max(0, Number(current.flujosActivos.value) - 1) } : current.flujosActivos } : current);
    } catch (err) {
      setError(err.message || "No se pudo eliminar el flujo.");
    } finally { setDeletingId(null); }
  };

  return (
    <AppShell>
      {/* Muestra directamente el Nombre de Usuario (username) */}
      <TopBar
        title={`¡Bienvenido/a, ${user?.username || "usuario"}! 👋`}
        subtitle="Aquí tienes el resumen de la actividad de tus procesos."
      />
      <div className="flex-1 overflow-auto p-8">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted dark:text-faint font-body mb-6">
            <Loader2 size={14} className="animate-spin" /> Cargando datos del backend…
          </div>
        )}
        {error && <p className="text-sm text-red font-body mb-6">Error: {error}</p>}

        {kpis && (
          <div className="flex items-center justify-between mb-6">
            <div className="grid grid-cols-3 gap-5 flex-1 mr-6">
              {Object.entries(kpis).map(([key, k]) => {
                const meta = KPI_META[key] || { label: key, icon: Gauge, tone: "text-blue" };
                return (
                  <Card key={key} className="p-5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-muted dark:text-faint font-body">{meta.label}</p>
                      <meta.icon size={15} className={meta.tone} />
                    </div>
                    <p className={`text-2xl font-semibold font-display ${meta.tone}`}>{k.value}</p>
                    <p className="text-xs text-faint font-body mt-1">{k.delta}</p>
                  </Card>
                );
              })}
            </div>
            <Link
              to="/flujos/nuevo"
              className="shrink-0 rounded-lg text-sm font-semibold text-white px-5 py-3 flex items-center gap-2 font-body transition-opacity hover:opacity-90"
              style={{ background: "#2F6FED" }}
            >
              <PlusCircle size={16} /> Nuevo Flujo
            </Link>
          </div>
        )}

        <div className="grid grid-cols-3 gap-6">
          <Card className="col-span-2 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold font-display text-ink dark:text-white">Mis Flujos</h2>
              <Link to="/flujos" className="text-xs text-blue font-body flex items-center gap-1 hover:underline">
                Ver todos <ChevronRight size={13} />
              </Link>
            </div>
            <div className="flex flex-col divide-y divide-border dark:divide-navyCard">
              {flows.map((f) => (
                <div key={f.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-ink dark:text-white font-body">{f.nombre}</p>
                    <p className="text-xs text-muted dark:text-faint font-body">{f.fecha} · {f.pasos} pasos</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Pill tone={f.estado === "Activo" ? "green" : "amber"}>{f.estado}</Pill>
                    <button type="button" onClick={() => handleDelete(f)} disabled={deletingId === f.id} title="Eliminar flujo" aria-label={`Eliminar ${f.nombre}`} className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50" >
                      {deletingId === f.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    </button>
                  </div>
                </div>
              ))}
              {!loading && flows.length === 0 && (
                <p className="text-xs text-faint font-body py-3">Todavía no tienes flujos.</p>
              )}
            </div>
          </Card>

          <Card className="p-6" style={{ background: "linear-gradient(160deg, #0F1B33, #152449)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-blue" />
              <h2 className="text-sm font-semibold font-display text-white">Sugerencia de IA</h2>
            </div>
            <p className="text-xs leading-relaxed text-faint font-body mb-4">
              El paso "Revisión de RRHH" en tu flujo de vacaciones tiene un tiempo promedio de 72 horas.
              Automatizar la verificación de días con el sistema de nómina podría ahorrar hasta 48 horas.
            </p>
            <Link
              to="/flujos/nuevo"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white rounded-lg px-3 py-2 transition-opacity hover:opacity-80"
              style={{ background: "rgba(255,255,255,0.1)" }}
            >
              Ver detalle <ChevronRight size={12} />
            </Link>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}