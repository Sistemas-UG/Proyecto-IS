import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PlusCircle, Workflow, ChevronRight, Search, Loader2, Trash2 } from "lucide-react";
import AppShell, { TopBar } from "../components/AppShell";
import { Card, Pill } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";

export default function MisFlujos() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  // Normaliza la estructura del backend evitando errores de runtime
  const normalizeFlow = (f) => {
    // Parseo seguro de fecha
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

    // Extracción exhaustiva de pasos/nodos (JSON o Arrays)
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
      pasos: totalPasos,
      estado: f.estado || f.status || "Activo",
    };
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    api
      .getFlows()
      .then((res) => {
        if (!cancelled) {
          const rawList = Array.isArray(res) ? res : res?.flows || res?.data || [];
          setFlows(rawList.map(normalizeFlow));
        }
      })
      .catch((err) => {
        console.error("Error al obtener los flujos:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleDelete = async (flow) => {
    if (!window.confirm(`¿Seguro que deseas eliminar el flujo "${flow.nombre}"? Esta acción no se puede deshacer.`)) return;
    setDeletingId(flow.id); setError("");
    try {
      await api.deleteFlow(flow.id);
      setFlows((current) => current.filter((item) => item.id !== flow.id));
    } catch (err) { setError(err.message || "No se pudo eliminar el flujo."); }
    finally { setDeletingId(null); }
  };

  // Filtrado reactivo mediante el buscador
  const filteredFlows = flows.filter(
    (f) =>
      f.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.estado?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AppShell>
      <TopBar
        title="Mis Flujos"
        subtitle="Procesos que has creado o generado con IA."
        right={
          <div className="flex items-center gap-2 rounded-xl px-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm h-[36px]">
            <Search size={14} className="text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Buscar flujo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none w-36 sm:w-48 font-body"
            />
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-6 md:p-8 w-full max-w-7xl mx-auto font-body">
        {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-slate-500 dark:text-slate-400 font-body">
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-blue-500" /> Cargando flujos...
              </span>
            ) : (
              `${filteredFlows.length} flujos registrados`
            )}
          </p>

          <Link
            to="/flujos/nuevo"
            className="rounded-xl text-sm font-semibold text-white px-4 py-2.5 flex items-center gap-2 font-body bg-blue-600 hover:bg-blue-500 transition-all duration-200 shadow-md shadow-blue-500/20 active:scale-[0.98]"
          >
            <PlusCircle size={16} /> Nuevo Flujo
          </Link>
        </div>

        <Card className="overflow-hidden border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-sm dark:shadow-2xl bg-white dark:bg-[#111827]/90 backdrop-blur-xl">
          {/* Header de la Tabla */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_0.6fr] px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800/80 uppercase tracking-wider font-body">
            <span>Nombre</span>
            <span>Fecha de creación</span>
            <span>Pasos</span>
            <span>Estado</span>
            <span></span>
          </div>

          {/* Lista de Filas */}
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <Loader2 size={20} className="animate-spin mx-auto mb-2 text-blue-500" />
              Obteniendo datos...
            </div>
          ) : filteredFlows.length === 0 ? (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400">
              <Workflow size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No se encontraron flujos</p>
              <p className="text-xs text-slate-400 mt-1">Crea tu primer flujo para comenzar a trabajar.</p>
              <Link
                to="/flujos/nuevo"
                className="inline-flex items-center gap-2 mt-4 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                <PlusCircle size={14} /> Crear flujo ahora
              </Link>
            </div>
          ) : (
            filteredFlows.map((f) => (
              <div
                key={f.id}
                className="grid grid-cols-[2fr_1fr_1fr_1fr_0.8fr] items-center px-6 py-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors border-t border-slate-100 dark:border-slate-800/60 first:border-t-0 group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 w-9 h-9 text-blue-600 dark:text-blue-400 shrink-0 group-hover:scale-105 transition-transform">
                    <Workflow size={16} />
                  </div>
                  <button type="button" onClick={() => navigate(`/flujos/${f.id}`)} className="text-left text-sm font-medium text-slate-900 dark:text-white font-body group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {f.nombre}
                  </button>
                </div>

                <span className="text-xs text-slate-500 dark:text-slate-400 font-body font-mono">
                  {f.fecha}
                </span>

                <span className="text-sm text-slate-600 dark:text-slate-300 font-body font-medium">
                  {f.pasos} {f.pasos === 1 ? "paso" : "pasos"}
                </span>

                <div>
                  <Pill tone={f.estado === "Activo" ? "green" : "amber"}>
                    {f.estado}
                  </Pill>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button type="button" onClick={() => handleDelete(f)} disabled={deletingId === f.id} title="Eliminar flujo" aria-label={`Eliminar ${f.nombre}`} className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50">
                    {deletingId === f.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  </button>
                  <button type="button" onClick={() => navigate(`/flujos/${f.id}`)} className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:translate-x-1 transition-transform font-body">Abrir <ChevronRight size={14} /></button>
                </div>
              </div>
            ))
          )}
        </Card>
      </div>
    </AppShell>
  );
}