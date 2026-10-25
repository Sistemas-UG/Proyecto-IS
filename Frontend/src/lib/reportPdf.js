import jsPDF from "jspdf";
import { layoutFlowGeometry } from "./flowLayout";

// Generador ÚNICO del PDF "Informe de eficiencia". Lo usan:
//   - Crear Flujo (vista previa y descarga del reporte recién generado)
//   - Reportes (vista previa y descarga de reportes guardados)
// Así el usuario ve siempre el mismo PDF. Si se le pasa `flow`, el diagrama
// del flujo se dibuja al final del documento (layout de dagre, igual que Mis Flujos).

const NAVY = [15, 32, 60];
const BLUE = [37, 99, 235];
const MUTED = [100, 116, 139];
const INK = [30, 41, 59];
const LIGHT_BLUE = [239, 246, 255];
const BORDER = [226, 232, 240];
const GREEN = [18, 148, 107];
const GREEN_SOFT = [231, 248, 240];
const RED = [214, 65, 75];

const MARGIN = 48;
const LINE_H = 14;

// Quita el formato Markdown inline (**negrita**, *cursiva*, `código`, ~~tachado~~).
const limpiarTexto = (texto) =>
  String(texto || "")
    .replace(/\r/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/~~(.*?)~~/g, "$1")
    .trim();

// Gemini a veces abre con una frase de cortesía ("Claro, aquí tienes el informe...").
// No pertenece al informe, así que se omite si aparece como primera línea.
function quitarIntroduccion(lineas) {
  const idx = lineas.findIndex((l) => l.trim() !== "");
  if (idx === -1) return lineas;
  const primera = lineas[idx].trim();
  const esIntro =
    primera.length < 180 &&
    /^(claro|por supuesto|aqu[ií] tienes|a continuaci[oó]n|desde luego|sure|here is)/i.test(primera);
  return esIntro ? lineas.slice(idx + 1) : lineas;
}

function nombreSeguro(titulo) {
  return String(titulo || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Construye el documento jsPDF.
 * @param {object} opts
 * @param {string} opts.titulo       Título del informe (se ve en el encabezado)
 * @param {string} opts.texto        Texto del reporte (Markdown simple) generado por la IA
 * @param {string|Date} [opts.generatedEn]  Fecha de generación (la de la BD)
 * @param {number|string} [opts.ahorroHoras] Ahorro estimado en horas
 * @param {{nodes:Array, edges:Array}} [opts.flow] Flujo a dibujar al final (formato crudo: id/label/type)
 */
export function buildReportDoc({ titulo, texto, generatedEn, ahorroHoras, flow }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  const bottomLimit = pageHeight - 62;

  const tituloFinal = titulo || "Flujo sin nombre";

  const fechaValida = generatedEn ? new Date(generatedEn) : new Date();
  const fecha = Number.isNaN(fechaValida.getTime())
    ? new Date().toLocaleString("es-GT")
    : fechaValida.toLocaleString("es-GT");

  let y = 0;

  const ajustar = (t, ancho) => doc.splitTextToSize(String(t || ""), ancho);

  // ---------- Encabezado / pie / espacio ----------
  const dibujarEncabezado = () => {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pageWidth, 112, "F");

    doc.setFillColor(...BLUE);
    doc.roundedRect(MARGIN, 22, 36, 36, 8, 8, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text("SF", MARGIN + 8, 45);

    doc.setFontSize(9);
    doc.setTextColor(191, 219, 254);
    doc.text("SMARTFLOW AI", MARGIN + 47, 31);

    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text("Informe de eficiencia", MARGIN, 79);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(219, 234, 254);
    doc.text(ajustar(tituloFinal, contentWidth).slice(0, 2), MARGIN, 96);

    y = 135;
  };

  const nuevaPagina = () => {
    doc.addPage();
    dibujarEncabezado();
  };

  const comprobarEspacio = (alto) => {
    if (y + alto > bottomLimit) nuevaPagina();
  };

  const dibujarPiePagina = () => {
    const total = doc.internal.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.7);
      doc.line(MARGIN, pageHeight - 42, pageWidth - MARGIN, pageHeight - 42);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text("SmartFlow AI | Informe de eficiencia", MARGIN, pageHeight - 25);
      doc.text(`Página ${p} de ${total}`, pageWidth - MARGIN, pageHeight - 25, { align: "right" });
    }
  };

  // ---------- Tarjeta fecha / ahorro ----------
  const dibujarTarjetaInformacion = () => {
    const top = y;
    const alto = 54;
    doc.setFillColor(...LIGHT_BLUE);
    doc.roundedRect(MARGIN, top, contentWidth, alto, 8, 8, "F");

    const mitad = MARGIN + contentWidth / 2;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("FECHA DE GENERACIÓN", MARGIN + 13, top + 18);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text(ajustar(fecha, contentWidth / 2 - 25).slice(0, 2), MARGIN + 13, top + 34);

    doc.setDrawColor(...BORDER);
    doc.line(mitad, top + 9, mitad, top + alto - 9);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("AHORRO ESTIMADO", mitad + 13, top + 18);

    const ahorro = Number(ahorroHoras);
    doc.setFontSize(14);
    doc.setTextColor(...BLUE);
    if (ahorroHoras !== null && ahorroHoras !== undefined && ahorroHoras !== "" && Number.isFinite(ahorro)) {
      doc.text(`${ahorro} horas`, mitad + 13, top + 39);
    } else {
      doc.setFontSize(10);
      doc.text("No especificado", mitad + 13, top + 37);
    }

    y += alto + 25;
  };

  // ---------- Bloques de texto ----------
  const dibujarSeccion = (texto) => {
    const t = limpiarTexto(texto);
    if (!t) return;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    const lineas = ajustar(t, contentWidth - 22);
    const alto = Math.max(29, lineas.length * 14 + 13);
    comprobarEspacio(alto + 8);

    doc.setFillColor(...LIGHT_BLUE);
    doc.roundedRect(MARGIN, y, contentWidth, alto, 5, 5, "F");
    doc.setFillColor(...BLUE);
    doc.roundedRect(MARGIN, y, 4, alto, 2, 2, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...NAVY);
    doc.text(lineas, MARGIN + 13, y + 18);
    y += alto + 12;
  };

  // Línea completa en negrita (**Título**): subtítulo sin caja.
  const dibujarSubtitulo = (texto) => {
    const t = limpiarTexto(texto);
    if (!t) return;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const lineas = ajustar(t, contentWidth);
    comprobarEspacio(lineas.length * LINE_H + 6);
    doc.setTextColor(...NAVY);
    doc.text(lineas, MARGIN, y);
    y += lineas.length * LINE_H + 5;
  };

  const dibujarParrafo = (texto) => {
    const t = limpiarTexto(texto);
    if (!t) return;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    ajustar(t, contentWidth).forEach((linea) => {
      comprobarEspacio(LINE_H);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...INK);
      doc.text(linea, MARGIN, y);
      y += LINE_H;
    });
    y += 9;
  };

  // "**Para:** Dirección General" -> etiqueta en negrita + valor, cada uno en su línea.
  const dibujarClaveValor = (etiqueta, valor) => {
    const et = limpiarTexto(etiqueta);
    const val = limpiarTexto(valor);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    const wEt = doc.getTextWidth(et + " ");
    const lineas = ajustar(val, contentWidth - wEt);
    comprobarEspacio(Math.max(1, lineas.length) * LINE_H + 4);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...NAVY);
    doc.text(et, MARGIN, y);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...INK);
    lineas.forEach((l, i) => {
      doc.text(l, MARGIN + wEt, y + i * LINE_H);
    });
    y += Math.max(1, lineas.length) * LINE_H + 4;
  };

  // marcador: null = viñeta (punto azul); texto = número ("1.")
  const dibujarItem = (texto, nivel = 0, marcador = null) => {
    const t = limpiarTexto(texto);
    if (!t) return;
    const sangria = nivel * 16;
    const xTexto = MARGIN + sangria + 17;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    const lineas = ajustar(t, contentWidth - sangria - 17);
    comprobarEspacio(lineas.length * LINE_H + 8);

    if (marcador) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BLUE);
      doc.text(marcador, MARGIN + sangria + 1, y);
    } else {
      doc.setFillColor(...BLUE);
      doc.circle(MARGIN + sangria + 5, y - 3, nivel ? 1.7 : 2.2, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(lineas, xTexto, y);
    y += lineas.length * LINE_H + 6;
  };

  // ---------- Diagrama del flujo ----------
  const dibujarFlujo = (rawFlow) => {
    const rawNodes = rawFlow?.nodes || [];
    if (!rawNodes.length) return;
    const geo = layoutFlowGeometry(rawNodes, rawFlow.edges || []);

    nuevaPagina();
    dibujarSeccion("Diagrama del flujo");

    // Leyenda
    const leyenda = [
      { t: "Inicio", fill: NAVY, border: NAVY },
      { t: "Paso", fill: [255, 255, 255], border: BORDER },
      { t: "Decisión", fill: [255, 255, 255], border: BLUE },
      { t: "Fin", fill: GREEN_SOFT, border: GREEN },
    ];
    let lx = MARGIN;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    leyenda.forEach((item) => {
      doc.setFillColor(...item.fill);
      doc.setDrawColor(...item.border);
      doc.setLineWidth(0.9);
      doc.roundedRect(lx, y - 7, 14, 9, 2.5, 2.5, "FD");
      doc.setTextColor(...MUTED);
      doc.text(item.t, lx + 19, y);
      lx += 19 + doc.getTextWidth(item.t) + 18;
    });
    doc.setDrawColor(...GREEN);
    doc.setLineWidth(1.2);
    doc.line(lx, y - 3, lx + 16, y - 3);
    doc.setTextColor(...MUTED);
    doc.text("Sí", lx + 21, y);
    lx += 21 + doc.getTextWidth("Sí") + 16;
    doc.setDrawColor(...RED);
    doc.line(lx, y - 3, lx + 16, y - 3);
    doc.text("No", lx + 21, y);
    y += 22;

    // Escala: cabe a lo ancho; si es muy alto se parte en varias páginas
    // por los espacios entre filas de nodos (nunca corta un nodo a la mitad).
    const MIN_ESCALA = 0.6;
    const MAX_ESCALA = 0.9;
    const alturaDisponible = bottomLimit - y;
    let escala = Math.min(MAX_ESCALA, contentWidth / geo.width, alturaDisponible / geo.height);
    escala = Math.max(MIN_ESCALA, Math.min(escala, contentWidth / geo.width));
    const offsetX = MARGIN + (contentWidth - geo.width * escala) / 2;

    // Cortes de página en coordenadas del diagrama
    const cortes = [0];
    let inicio = 0;
    let capacidad = alturaDisponible / escala;
    const capacidadSiguiente = (bottomLimit - 135 - 20) / escala;
    while (geo.height - inicio > capacidad + 0.5) {
      const limite = inicio + capacidad;
      let corte = null;
      geo.nodes.forEach((n) => {
        const candidato = n.y + n.height + 45; // medio del hueco bajo el nodo
        const cruzaAlgun = geo.nodes.some((m) => m.y < candidato && m.y + m.height > candidato);
        if (!cruzaAlgun && candidato > inicio + 40 && candidato <= limite) {
          if (corte === null || candidato > corte) corte = candidato;
        }
      });
      if (corte === null) corte = limite; // respaldo
      cortes.push(corte);
      inicio = corte;
      capacidad = capacidadSiguiente;
    }
    cortes.push(geo.height + 1);

    const fuenteNodo = Math.max(6.5, Math.min(10, 12 * escala));

    const estiloNodo = (tipo) => {
      if (tipo === "inicio") return { fill: NAVY, border: NAVY, text: [255, 255, 255] };
      if (tipo === "fin") return { fill: GREEN_SOFT, border: GREEN, text: GREEN };
      if (tipo === "decision") return { fill: [255, 255, 255], border: BLUE, text: INK };
      return { fill: [255, 255, 255], border: BORDER, text: INK };
    };
    const colorArista = (label) => {
      if (label === "No") return RED;
      if (label === "Sí" || label === "Si") return GREEN;
      return MUTED;
    };

    cortes.slice(0, -1).forEach((y0, i) => {
      const y1 = cortes[i + 1];
      if (i > 0) {
        nuevaPagina();
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(...MUTED);
        doc.text("Diagrama del flujo (continuación)", MARGIN, y);
        y += 14;
      }
      const oy = y;
      const X = (x) => offsetX + x * escala;
      const Y = (yy) => oy + (yy - y0) * escala;

      // Conexiones (debajo de los nodos)
      geo.edges.forEach((e) => {
        const pts = e.points;
        if (pts.length < 2) return;
        const color = colorArista(e.label);
        doc.setDrawColor(...color);
        doc.setLineWidth(1.1);

        for (let k = 0; k < pts.length - 1; k++) {
          let a = pts[k];
          let b = pts[k + 1];
          if ((a.y < y0 && b.y < y0) || (a.y > y1 && b.y > y1)) continue;
          // recorte vertical al tramo de esta página
          const recortar = (p, q, limite) => {
            const t = (limite - p.y) / (q.y - p.y);
            return { x: p.x + (q.x - p.x) * t, y: limite };
          };
          if (a.y < y0 && b.y !== a.y) a = recortar(a, b, y0);
          if (b.y < y0 && b.y !== a.y) b = recortar(b, a, y0);
          if (a.y > y1 && b.y !== a.y) a = recortar(a, b, y1);
          if (b.y > y1 && b.y !== a.y) b = recortar(b, a, y1);
          doc.line(X(a.x), Y(a.y), X(b.x), Y(b.y));
        }

        // Punta de flecha en el destino (solo si cae en esta página)
        const fin = pts[pts.length - 1];
        const prev = pts[pts.length - 2];
        if (fin.y >= y0 && fin.y <= y1) {
          const ang = Math.atan2(Y(fin.y) - Y(prev.y), X(fin.x) - X(prev.x));
          const tam = 5.5;
          const tx = X(fin.x);
          const ty = Y(fin.y);
          doc.setFillColor(...color);
          doc.triangle(
            tx, ty,
            tx - tam * Math.cos(ang - 0.45), ty - tam * Math.sin(ang - 0.45),
            tx - tam * Math.cos(ang + 0.45), ty - tam * Math.sin(ang + 0.45),
            "F"
          );
        }
      });

      // Nodos de esta página
      geo.nodes.forEach((n) => {
        if (n.y < y0 || n.y + n.height > y1) return;
        const st = estiloNodo(n.type);
        const nx = X(n.x);
        const ny = Y(n.y);
        const nw = n.width * escala;
        const nh = n.height * escala;
        doc.setFillColor(...st.fill);
        doc.setDrawColor(...st.border);
        doc.setLineWidth(n.type === "decision" ? 1.3 : 0.9);
        doc.roundedRect(nx, ny, nw, nh, 8 * escala, 8 * escala, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(fuenteNodo);
        doc.setTextColor(...st.text);
        let lineas = doc.splitTextToSize(String(n.label || ""), nw - 12);
        const alto = fuenteNodo * 1.2;
        const maxLineas = Math.max(1, Math.floor((nh - 8) / alto));
        if (lineas.length > maxLineas) {
          lineas = lineas.slice(0, maxLineas);
          lineas[maxLineas - 1] = lineas[maxLineas - 1].replace(/.{0,2}$/, "") + "…";
        }
        const bloque = lineas.length * alto;
        const baseY = ny + (nh - bloque) / 2 + fuenteNodo * 0.9;
        lineas.forEach((l, j) => {
          doc.text(l, nx + nw / 2, baseY + j * alto, { align: "center" });
        });
      });

      // Etiquetas Sí / No (encima de todo)
      geo.edges.forEach((e) => {
        if (!e.label || e.points.length < 2) return;
        // punto medio por longitud del trazo
        let total = 0;
        for (let k = 0; k < e.points.length - 1; k++) {
          total += Math.hypot(e.points[k + 1].x - e.points[k].x, e.points[k + 1].y - e.points[k].y);
        }
        let objetivo = total * 0.4;
        let pos = e.points[0];
        for (let k = 0; k < e.points.length - 1; k++) {
          const seg = Math.hypot(e.points[k + 1].x - e.points[k].x, e.points[k + 1].y - e.points[k].y);
          if (objetivo <= seg && seg > 0) {
            const t = objetivo / seg;
            pos = {
              x: e.points[k].x + (e.points[k + 1].x - e.points[k].x) * t,
              y: e.points[k].y + (e.points[k + 1].y - e.points[k].y) * t,
            };
            break;
          }
          objetivo -= seg;
        }
        if (pos.y < y0 + 4 || pos.y > y1 - 4) return;
        const color = colorArista(e.label);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(Math.max(7, 8.5 * escala + 1));
        const w = doc.getTextWidth(e.label) + 8;
        const h = 11;
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(...color);
        doc.setLineWidth(0.7);
        doc.roundedRect(X(pos.x) - w / 2, Y(pos.y) - h / 2, w, h, 3, 3, "FD");
        doc.setTextColor(...color);
        doc.text(e.label, X(pos.x), Y(pos.y) + 2.8, { align: "center" });
      });

      if (i < cortes.length - 2) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(...MUTED);
        doc.text("El diagrama continúa en la siguiente página", pageWidth - MARGIN, bottomLimit + 14, { align: "right" });
      }
    });
  };

  // ---------- Armado ----------
  dibujarEncabezado();
  dibujarTarjetaInformacion();

  const lineas = quitarIntroduccion(
    String(texto || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
  );

  let parrafo = [];
  const vaciarParrafo = () => {
    if (parrafo.length) {
      dibujarParrafo(parrafo.join(" "));
      parrafo = [];
    }
  };

  lineas.forEach((original) => {
    const linea = original.trim();
    const sangria = original.match(/^\s*/)[0].length;

    if (!linea || /^-{3,}$/.test(linea) || /^\*{3,}$/.test(linea) || /^_{3,}$/.test(linea)) {
      vaciarParrafo();
      return;
    }
    if (/^#{1,6}\s+/.test(linea)) {
      vaciarParrafo();
      dibujarSeccion(linea.replace(/^#{1,6}\s+/, ""));
      return;
    }
    // Línea entera en negrita
    if (/^(\*\*|__)(?!.*\1.*\1).+\1$/.test(linea) && !/^\*\*[^*]+:\*\*\s+\S/.test(linea)) {
      vaciarParrafo();
      dibujarSubtitulo(linea);
      return;
    }
    // "**Etiqueta:** valor"
    const kv = linea.match(/^\*\*([^*]+?:)\*\*\s*(.+)$/);
    if (kv) {
      vaciarParrafo();
      dibujarClaveValor(kv[1], kv[2]);
      return;
    }
    // Lista numerada
    const num = linea.match(/^(\d+[.)])\s+(.+)$/);
    if (num) {
      vaciarParrafo();
      dibujarItem(num[2], sangria >= 1 ? 1 : 0, num[1]);
      return;
    }
    // Viñeta
    if (/^[-*•]\s+/.test(linea)) {
      vaciarParrafo();
      dibujarItem(linea.replace(/^[-*•]\s+/, ""), sangria >= 1 ? 1 : 0);
      return;
    }
    parrafo.push(linea);
  });
  vaciarParrafo();

  if (flow?.nodes?.length) dibujarFlujo(flow);

  dibujarPiePagina();
  return doc;
}

/** Devuelve { blob, filename } listo para vista previa (iframe) o descarga. */
export function crearReportePDF(opts) {
  const doc = buildReportDoc(opts);
  return {
    blob: doc.output("blob"),
    filename: `reporte-eficiencia-${nombreSeguro(opts.titulo) || "flujo"}.pdf`,
  };
}
