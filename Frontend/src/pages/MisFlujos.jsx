import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  PlusCircle, 
  Workflow, 
  ChevronRight, 
  Search, 
  Loader2, 
  Trash2, 
  CheckCircle2, 
  X, 
  AlertTriangle 
} from "lucide-react";
import AppShell, { TopBar } from "../components/AppShell";
import { Card, Pill } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";

export default function MisFlujos() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  
  // Estado para el flujo seleccionado a eliminar y carga de eliminación
  const [flowToDelete, setFlowToDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);

  // Normaliza la estructura recibida del backend
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
          const normalized = rawList.map(normalizeFlow);
          setFlows(normalized);
          localStorage.setItem("smartflow_cached_flows", JSON.stringify(normalized));
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

  // --- CAMBIO OPTIMISTA DE ESTADO (Activo <-> Completado) ---
  const handleToggleStatus = async (flow) => {
    const estadoOriginal = flow.estado;
    const nuevoEstado = estadoOriginal === "Activo" ? "Completado" : "Activo";

    setFlows((prev) => {
      const updated = prev.map((item) => (item.id === flow.id ? { ...item, estado: nuevoEstado } : item));
      localStorage.setItem("smartflow_cached_flows", JSON.stringify(updated));
      return updated;
    });
    setUpdatingStatusId(flow.id);

    try {
      if (typeof api.updateFlow === "function") {
        await api.updateFlow(flow.id, { estado: nuevoEstado });
      } else if (typeof api.updateFlowStatus === "function") {
        await api.updateFlowStatus(flow.id, nuevoEstado);
      }
    } catch (err) {
      console.error("Error al guardar estado en el backend:", err);
      setFlows((prev) => {
        const reverted = prev.map((item) => (item.id === flow.id ? { ...item, estado: estadoOriginal } : item));
        localStorage.setItem("smartflow_cached_flows", JSON.stringify(reverted));
        return reverted;
      });
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // --- CONFIRMACIÓN Y BORRADO EN BASE DE DATOS (Cloud SQL / PostgreSQL) ---
  const confirmDelete = async () => {
    if (!flowToDelete) return;
    
    setDeletingId(flowToDelete.id);
    setError("");

    try {
      // 1. Petición DELETE a la base de datos PostgreSQL
      await api.deleteFlow(flowToDelete.id);
      
      // 2. Sincroniza estado de React y caché local para el Dashboard
      setFlows((current) => {
        const updated = current.filter((item) => item.id !== flowToDelete.id);
        localStorage.setItem("smartflow_cached_flows", JSON.stringify(updated));
        return updated;
      });

      setFlowToDelete(null);
    } catch (err) {
      setError(err.message || "No se pudo eliminar el flujo de la base de datos.");
    } finally {
      setDeletingId(null);
    }
  };

  // Filtrado reactivo por nombre o estado
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
        {error && (
          <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        
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
          {/* Header de Tabla */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_0.6fr] px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800/80 uppercase tracking-wider font-body">
            <span>Nombre</span>
            <span>Fecha de creación</span>
            <span>Pasos</span>
            <span>Estado</span>
            <span></span>
          </div>

          {/* Filas */}
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
                <div className="flex items-center min-w-0">
                  <button 
                    type="button" 
                    onClick={() => navigate(`/flujos/${f.id}`)} 
                    className="text-left text-sm font-semibold text-slate-900 dark:text-white font-body group-hover:text-blue-500 transition-colors cursor-pointer truncate"
                  >
                    {f.nombre}
                  </button>
                </div>

                <span className="text-xs text-slate-500 dark:text-slate-400 font-body font-mono">
                  {f.fecha}
                </span>

                <span className="text-sm text-slate-600 dark:text-slate-300 font-body font-medium">
                  {f.pasos} {f.pasos === 1 ? "paso" : "pasos"}
                </span>

                {/* Botón Clicable de Estado */}
                <div>
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(f)}
                    disabled={updatingStatusId === f.id}
                    title="Haz clic para cambiar el estado del flujo"
                    className="hover:scale-105 active:scale-95 transition-transform cursor-pointer inline-flex items-center gap-1.5"
                  >
                    {updatingStatusId === f.id ? (
                      <Loader2 size={13} className="animate-spin text-blue-500" />
                    ) : (
                      <Pill tone={f.estado === "Activo" ? "green" : f.estado === "Completado" ? "blue" : "amber"}>
                        {f.estado === "Completado" && <CheckCircle2 size={11} className="inline mr-1" />}
                        {f.estado}
                      </Pill>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button 
                    type="button" 
                    onClick={() => setFlowToDelete(f)} 
                    title="Eliminar flujo" 
                    aria-label={`Eliminar ${f.nombre}`} 
                    className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                  >
                    <Trash2 size={15} />
                  </button>
                  <button 
                    type="button" 
                    onClick={() => navigate(`/flujos/${f.id}`)} 
                    className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:translate-x-1 transition-transform font-body cursor-pointer"
                  >
                    Abrir <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </Card>
      </div>

      {/* --- MODAL PERSONALIZADO PARA CONFIRMAR ELIMINACIÓN --- */}
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
                className="px-4 py-2.5 text-xs font-semibold rounded-xl text-white bg-red-600 hover:bg-red-500 transition-colors shadow-md shadow-red-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {deletingId === flowToDelete.id ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Eliminando...
                  </>
                ) : (
                  "Eliminar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}