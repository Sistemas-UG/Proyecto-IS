import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import {
  Sparkles, Loader2, ChevronDown, FileDown, Clock, TrendingUp, Search, Inbox, X, Eye,
} from "lucide-react";
import AppShell, { TopBar } from "../components/AppShell";
import { api } from "../lib/api";

// Página de Reportes, rediseñada con el mismo lenguaje visual de "Crear
// Flujo" (tokens navy/blue de AppShell). Muestra los reportes de eficiencia
// generados por IA en "Crear Flujo" y guardados permanentemente en el
// backend (campo CLOB), con búsqueda, resumen y descarga individual de PDF.
export default function Reportes() {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .getInsights()
      .then((res) => !cancelled && setInsights(res.insights || []))
      .catch((err) => !cancelled && setError(err.message || "No se pudieron cargar los reportes."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return insights;
    const q = query.trim().toLowerCase();
    return insights.filter((i) => (i.titulo || "").toLowerCase().includes(q));
  }, [insights, query]);

  const totalHoras = useMemo(
    () => insights.reduce((acc, i) => acc + (Number(i.ahorroEstimadoHoras) || 0), 0),
    [insights]
  );

  const ultimo = useMemo(() => {
    if (!insights.length) return null;
    return [...insights].sort((a, b) => new Date(b.generatedEn) - new Date(a.generatedEn))[0];
  }, [insights]);

  // Construye el PDF como Blob para previsualizarlo antes de descargarlo.
  const crearPDF = (insight) => {
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const margin = 40;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`Reporte de Eficiencia — ${insight.titulo || "Flujo sin nombre"}`, margin, 60);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(new Date(insight.generatedEn).toLocaleString("es-GT"), margin, 78);
    doc.setTextColor(0);
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(insight.reporteTexto || "", 515);
    doc.text(lines, margin, 100);
    return { blob: doc.output("blob"), filename: `reporte-eficiencia-${(insight.titulo || "flujo").toLowerCase().replace(/\s+/g, "-")}.pdf` };
  };

  const previsualizarPDF = (insight) => {
    const { blob, filename } = crearPDF(insight);
    const url = URL.createObjectURL(blob);
    setPreview((current) => { if (current?.url) URL.revokeObjectURL(current.url); return { url, filename, titulo: insight.titulo || "Reporte de eficiencia" }; });
  };

  const descargarPDF = () => {
    if (!preview) return;
    const link = document.createElement("a"); link.href = preview.url; link.download = preview.filename;
    document.body.appendChild(link); link.click(); link.remove();
  };

  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url); }, [preview?.url]);

  return (
    <AppShell>
      <TopBar
        title="Reportes"
        subtitle="Reportes de eficiencia generados por IA a partir de tus flujos, guardados automáticamente."
      />

      <div className="flex-1 overflow-auto p-6 md:p-8 w-full max-w-5xl mx-auto font-body">
        {/* Resumen */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-navy border border-border dark:border-navyCard rounded-2xl p-5 transition-colors">
            <div className="flex items-center gap-2 text-muted dark:text-faint text-xs font-semibold font-body mb-2">
              <Sparkles size={14} className="text-blue" /> Reportes generados
            </div>
            <p className="text-2xl font-bold font-display text-ink dark:text-white">{insights.length}</p>
          </div>
          <div className="bg-white dark:bg-navy border border-border dark:border-navyCard rounded-2xl p-5 transition-colors">
            <div className="flex items-center gap-2 text-muted dark:text-faint text-xs font-semibold font-body mb-2">
              <TrendingUp size={14} className="text-green dark:text-emerald-400" /> Horas ahorradas (estimado)
            </div>
            <p className="text-2xl font-bold font-display text-ink dark:text-white">{totalHoras}h</p>
          </div>
          <div className="bg-white dark:bg-navy border border-border dark:border-navyCard rounded-2xl p-5 transition-colors">
            <div className="flex items-center gap-2 text-muted dark:text-faint text-xs font-semibold font-body mb-2">
              <Clock size={14} className="text-blue" /> Último generado
            </div>
            <p className="text-sm font-semibold text-ink dark:text-white truncate">
              {ultimo ? new Date(ultimo.generatedEn).toLocaleDateString("es-GT") : "—"}
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
            <Loader2 size={16} className="animate-spin" /> Cargando reportes…
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
                ? 'Ve a "Crear Flujo", genera tu diagrama y pulsa "Reporte de Eficiencia (con IA)" — quedará guardado aquí.'
                : "Prueba con otro término de búsqueda."}
            </p>
          </div>
        )}

        {preview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Vista previa del reporte PDF">
            <div className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white dark:bg-navy shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-border dark:border-navyCard p-4">
                <div className="min-w-0"><h2 className="truncate text-sm font-semibold text-ink dark:text-white">{preview.titulo}</h2><p className="text-xs text-muted dark:text-faint">Vista previa del PDF</p></div>
                <div className="flex shrink-0 items-center gap-2">
                  <button onClick={descargarPDF} className="inline-flex items-center gap-2 rounded-lg bg-blue px-3 py-2 text-xs font-semibold text-white"><FileDown size={14}/> Descargar PDF</button>
                  <button onClick={() => setPreview(null)} aria-label="Cerrar vista previa" className="rounded-lg p-2 text-muted hover:bg-bg dark:text-faint dark:hover:bg-navyDeep"><X size={18}/></button>
                </div>
              </div>
              <iframe title={`Vista previa ${preview.titulo}`} src={preview.url} className="min-h-0 flex-1 bg-slate-100" />
            </div>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((insight) => {
              const isOpen = expandedId === insight.id;
              return (
                <div
                  key={insight.id}
                  className="rounded-2xl border border-border dark:border-navyCard bg-white dark:bg-navy overflow-hidden transition-colors"
                >
                  <div className="flex items-center justify-between gap-3 px-5 py-4">
                    <button
                      onClick={() => setExpandedId(isOpen ? null : insight.id)}
                      className="flex-1 flex items-center gap-3 text-left cursor-pointer min-w-0"
                    >
                      <div className="w-9 h-9 shrink-0 rounded-xl bg-blueSoft dark:bg-blue/15 border border-blue/20 dark:border-blue/30 flex items-center justify-center text-blue">
                        <Sparkles size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink dark:text-white truncate">
                          {insight.titulo || "Flujo sin nombre"}
                        </p>
                        <p className="text-[11px] text-muted dark:text-faint">
                          {new Date(insight.generatedEn).toLocaleString("es-GT")}
                          {insight.ahorroEstimadoHoras != null && ` · Ahorro estimado: ${insight.ahorroEstimadoHoras}h`}
                        </p>
                      </div>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => previsualizarPDF(insight)}
                        title="Vista previa del PDF"
                        className="flex items-center gap-1.5 text-xs font-medium text-ink dark:text-white border border-border dark:border-navyCard rounded-lg px-3 py-2 font-body bg-bg dark:bg-navyDeep hover:border-blue transition-colors cursor-pointer"
                      >
                        <Eye size={13} className="text-blue" />
                        <span className="hidden sm:inline">Vista previa</span>
                      </button>
                      <button
                        onClick={() => setExpandedId(isOpen ? null : insight.id)}
                        className="cursor-pointer text-faint"
                      >
                        <ChevronDown size={16} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 border-t border-border dark:border-navyCard">
                      <p className="text-xs leading-relaxed text-muted dark:text-faint whitespace-pre-wrap font-body">
                        {insight.reporteTexto}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}