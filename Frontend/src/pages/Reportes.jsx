
import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import {
  Sparkles,
  Loader2,
  ChevronDown,
  FileDown,
  Clock,
  TrendingUp,
  Search,
  Inbox,
  X,
  Eye,
} from "lucide-react";
import AppShell, { TopBar } from "../components/AppShell";
import { api } from "../lib/api";

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
      .then((res) => {
        if (!cancelled) setInsights(res.insights || []);
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

    return insights.filter((i) =>
      (i.titulo || "").toLowerCase().includes(q)
    );
  }, [insights, query]);

  const totalHoras = useMemo(
    () =>
      insights.reduce(
        (acc, i) => acc + (Number(i.ahorroEstimadoHoras) || 0),
        0
      ),
    [insights]
  );

  const ultimo = useMemo(() => {
    if (!insights.length) return null;

    return [...insights].sort(
      (a, b) => new Date(b.generatedEn) - new Date(a.generatedEn)
    )[0];
  }, [insights]);

  // Genera un PDF profesional con secciones, colores y paginación.
  const crearPDF = (insight) => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "letter",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const margin = 48;
    const contentWidth = pageWidth - margin * 2;
    const bottomLimit = pageHeight - 62;

    const navy = [15, 32, 60];
    const blue = [37, 99, 235];
    const muted = [100, 116, 139];
    const ink = [30, 41, 59];
    const lightBlue = [239, 246, 255];
    const border = [226, 232, 240];

    const titulo = insight.titulo || "Flujo sin nombre";

    const fechaValida = insight.generatedEn
      ? new Date(insight.generatedEn)
      : new Date();

    const fecha = Number.isNaN(fechaValida.getTime())
      ? new Date().toLocaleString("es-GT")
      : fechaValida.toLocaleString("es-GT");

    let y = 0;

    const limpiarTexto = (texto) =>
      String(texto || "")
        .replace(/\r/g, "")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/__(.*?)__/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/~~(.*?)~~/g, "$1")
        .trim();

    const textoAjustado = (texto, ancho) =>
      doc.splitTextToSize(String(texto || ""), ancho);

    const dibujarEncabezado = () => {
      doc.setFillColor(...navy);
      doc.rect(0, 0, pageWidth, 112, "F");

      doc.setFillColor(...blue);
      doc.roundedRect(margin, 22, 36, 36, 8, 8, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text("SF", margin + 8, 45);

      doc.setFontSize(9);
      doc.setTextColor(191, 219, 254);
      doc.text("SMARTFLOW AI", margin + 47, 31);

      doc.setFontSize(18);
      doc.setTextColor(255, 255, 255);
      doc.text("Informe de eficiencia", margin, 79);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(219, 234, 254);

      const tituloLineas = textoAjustado(titulo, contentWidth);
      doc.text(tituloLineas.slice(0, 2), margin, 96);

      y = 135;
    };

    const comprobarEspacio = (altoNecesario) => {
      if (y + altoNecesario > bottomLimit) {
        doc.addPage();
        dibujarEncabezado();
      }
    };

    const dibujarPiePagina = () => {
      const totalPaginas = doc.internal.getNumberOfPages();

      for (let pagina = 1; pagina <= totalPaginas; pagina++) {
        doc.setPage(pagina);

        doc.setDrawColor(...border);
        doc.setLineWidth(0.7);
        doc.line(
          margin,
          pageHeight - 42,
          pageWidth - margin,
          pageHeight - 42
        );

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...muted);

        doc.text("SmartFlow AI | Informe de eficiencia", margin, pageHeight - 25);

        doc.text(
          `Página ${pagina} de ${totalPaginas}`,
          pageWidth - margin,
          pageHeight - 25,
          { align: "right" }
        );
      }
    };

    const dibujarTarjetaInformacion = () => {
      const tarjetaY = y;
      const tarjetaH = 54;

      doc.setFillColor(...lightBlue);
      doc.roundedRect(
        margin,
        tarjetaY,
        contentWidth,
        tarjetaH,
        8,
        8,
        "F"
      );

      const mitad = margin + contentWidth / 2;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...muted);
      doc.text("FECHA DE GENERACIÓN", margin + 13, tarjetaY + 18);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...navy);

      const fechaLineas = textoAjustado(fecha, contentWidth / 2 - 25);
      doc.text(fechaLineas.slice(0, 2), margin + 13, tarjetaY + 34);

      doc.setDrawColor(...border);
      doc.line(mitad, tarjetaY + 9, mitad, tarjetaY + tarjetaH - 9);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...muted);
      doc.text("AHORRO ESTIMADO", mitad + 13, tarjetaY + 18);

      const ahorro = Number(insight.ahorroEstimadoHoras);

      doc.setFontSize(14);
      doc.setTextColor(...blue);

      if (
        insight.ahorroEstimadoHoras !== null &&
        insight.ahorroEstimadoHoras !== undefined &&
        insight.ahorroEstimadoHoras !== "" &&
        Number.isFinite(ahorro)
      ) {
        doc.text(`${ahorro} horas`, mitad + 13, tarjetaY + 39);
      } else {
        doc.setFontSize(10);
        doc.text("No especificado", mitad + 13, tarjetaY + 37);
      }

      y += tarjetaH + 25;
    };

    const dibujarSeccion = (texto) => {
      const tituloSeccion = limpiarTexto(texto);

      if (!tituloSeccion) return;

      const lineas = textoAjustado(tituloSeccion, contentWidth - 22);
      const alto = Math.max(29, lineas.length * 14 + 13);

      comprobarEspacio(alto + 8);

      doc.setFillColor(...lightBlue);
      doc.roundedRect(margin, y, contentWidth, alto, 5, 5, "F");

      doc.setFillColor(...blue);
      doc.roundedRect(margin, y, 4, alto, 2, 2, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...navy);

      doc.text(lineas, margin + 13, y + 18);

      y += alto + 12;
    };

    const dibujarParrafo = (texto) => {
      const contenido = limpiarTexto(texto);

      if (!contenido) return;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);

      const lineas = textoAjustado(contenido, contentWidth);
      const altoLinea = 14;

      let indice = 0;

      while (indice < lineas.length) {
        const espacioDisponible = bottomLimit - y;
        const lineasDisponibles = Math.floor(
          espacioDisponible / altoLinea
        );

        if (lineasDisponibles < 1) {
          doc.addPage();
          dibujarEncabezado();
          continue;
        }

        const fragmento = lineas.slice(
          indice,
          indice + lineasDisponibles
        );

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(...ink);
        doc.text(fragmento, margin, y);

        y += fragmento.length * altoLinea;
        indice += fragmento.length;

        if (indice < lineas.length) {
          doc.addPage();
          dibujarEncabezado();
        }
      }

      y += 9;
    };

    const dibujarViñeta = (texto) => {
      const contenido = limpiarTexto(
        texto.replace(/^[-*•]\s*/, "")
      );

      if (!contenido) return;

      const lineas = textoAjustado(contenido, contentWidth - 22);
      const altoLinea = 14;

      comprobarEspacio(lineas.length * altoLinea + 10);

      doc.setFillColor(...blue);
      doc.circle(margin + 5, y - 3, 2.2, "F");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...ink);

      doc.text(lineas, margin + 17, y);

      y += lineas.length * altoLinea + 8;
    };

    // Encabezado y resumen de datos.
    dibujarEncabezado();
    dibujarTarjetaInformacion();

    // Reconoce encabezados Markdown, listas y párrafos.
    const lineas = String(insight.reporteTexto || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n");

    let parrafo = [];

    const vaciarParrafo = () => {
      if (parrafo.length > 0) {
        dibujarParrafo(parrafo.join(" "));
        parrafo = [];
      }
    };

    lineas.forEach((lineaOriginal) => {
      const linea = lineaOriginal.trim();

      if (!linea || /^-{3,}$/.test(linea) || /^\*{3,}$/.test(linea)) {
        vaciarParrafo();
        return;
      }

      if (/^#{1,6}\s+/.test(linea)) {
        vaciarParrafo();
        dibujarSeccion(linea.replace(/^#{1,6}\s+/, ""));
        return;
      }

      if (/^(\*\*|__)\s*.+\s*(\*\*|__)$/.test(linea)) {
        vaciarParrafo();
        dibujarSeccion(linea);
        return;
      }

      if (/^[-*•]\s+/.test(linea)) {
        vaciarParrafo();
        dibujarViñeta(linea);
        return;
      }

      parrafo.push(limpiarTexto(linea));
    });

    vaciarParrafo();

    // Numera todas las páginas al terminar de generar el contenido.
    dibujarPiePagina();

    const nombreSeguro = titulo
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);

    return {
      blob: doc.output("blob"),
      filename: `reporte-eficiencia-${nombreSeguro || "flujo"}.pdf`,
    };
  };

  const previsualizarPDF = (insight) => {
    const { blob, filename } = crearPDF(insight);
    const url = URL.createObjectURL(blob);

    setPreview((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);

      return {
        url,
        filename,
        titulo: insight.titulo || "Reporte de eficiencia",
      };
    });
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

      <div className="flex-1 overflow-auto p-6 md:p-8 w-full max-w-5xl mx-auto font-body">
        {/* Resumen */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-navy border border-border dark:border-navyCard rounded-2xl p-5 transition-colors">
            <div className="flex items-center gap-2 text-muted dark:text-faint text-xs font-semibold font-body mb-2">
              <Sparkles size={14} className="text-blue" />
              Reportes generados
            </div>
            <p className="text-2xl font-bold font-display text-ink dark:text-white">
              {insights.length}
            </p>
          </div>

          <div className="bg-white dark:bg-navy border border-border dark:border-navyCard rounded-2xl p-5 transition-colors">
            <div className="flex items-center gap-2 text-muted dark:text-faint text-xs font-semibold font-body mb-2">
              <TrendingUp size={14} className="text-green dark:text-emerald-400" />
              Horas ahorradas (estimado)
            </div>
            <p className="text-2xl font-bold font-display text-ink dark:text-white">
              {totalHoras}h
            </p>
          </div>

          <div className="bg-white dark:bg-navy border border-border dark:border-navyCard rounded-2xl p-5 transition-colors">
            <div className="flex items-center gap-2 text-muted dark:text-faint text-xs font-semibold font-body mb-2">
              <Clock size={14} className="text-blue" />
              Último generado
            </div>
            <p className="text-sm font-semibold text-ink dark:text-white truncate">
              {ultimo
                ? new Date(ultimo.generatedEn).toLocaleDateString("es-GT")
                : "—"}
            </p>
          </div>
        </div>

        {/* Buscador */}
        <div className="relative mb-6">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar reporte por nombre del flujo…"
            className="w-full text-sm rounded-xl border border-border dark:border-navyCard bg-white dark:bg-navy pl-10 pr-4 py-3 text-ink dark:text-white font-body outline-none focus:border-blue transition-colors placeholder:text-muted/60 dark:placeholder:text-faint/50"
          />
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted dark:text-faint font-body">
            <Loader2 size={16} className="animate-spin" />
            Cargando reportes…
          </div>
        )}

        {!loading && error && (
          <p className="text-sm text-red font-body py-10 text-center">
            {error}
          </p>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-16 px-4 space-y-3 max-w-md mx-auto">
            <div className="w-20 h-20 bg-bg dark:bg-navyDeep border border-border dark:border-navyCard rounded-3xl flex items-center justify-center mx-auto text-faint shadow-inner">
              <Inbox size={34} strokeWidth={1.2} />
            </div>

            <h3 className="text-sm font-bold text-ink dark:text-white font-body">
              {insights.length === 0
                ? "Todavía no hay reportes"
                : "Sin resultados"}
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
                  <h2 className="truncate text-sm font-semibold text-ink dark:text-white">
                    {preview.titulo}
                  </h2>
                  <p className="text-xs text-muted dark:text-faint">
                    Vista previa del PDF · Informe ejecutivo
                  </p>
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

              <iframe
                title={`Vista previa ${preview.titulo}`}
                src={preview.url}
                className="min-h-0 flex-1 bg-slate-100"
              />
            </div>
          </div>
        )}

        {/* Lista de reportes */}
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
                      onClick={() =>
                        setExpandedId(isOpen ? null : insight.id)
                      }
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
                          {insight.generatedEn
                            ? new Date(insight.generatedEn).toLocaleString("es-GT")
                            : "Fecha no disponible"}

                          {insight.ahorroEstimadoHoras != null &&
                            ` · Ahorro estimado: ${insight.ahorroEstimadoHoras}h`}
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
                        onClick={() =>
                          setExpandedId(isOpen ? null : insight.id)
                        }
                        aria-label={isOpen ? "Contraer reporte" : "Expandir reporte"}
                        className="cursor-pointer text-faint"
                      >
                        <ChevronDown
                          size={16}
                          className={`transition-transform ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
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
