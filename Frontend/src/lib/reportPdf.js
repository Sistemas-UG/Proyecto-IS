import { jsPDF } from "jspdf";
import { layoutFlowGeometry } from "./flowLayout";

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;
const HEADER_H = 22;
const FOOTER_SAFE = 20;

const COLOR_PRIMARY = [15, 27, 51];
const COLOR_ACCENT = [59, 130, 246];
const COLOR_MUTED = [100, 116, 139];
const COLOR_TEXT = [30, 41, 59];

const NODE_COLORS = {
  inicio: { fill: [255, 255, 255], text: [15, 27, 51], border: [203, 213, 225] },
  fin: { fill: [255, 255, 255], text: [15, 27, 51], border: [203, 213, 225] },
  decision: { fill: [255, 255, 255], text: [30, 41, 59], border: [59, 130, 246] },
  paso: { fill: [255, 255, 255], text: [30, 41, 59], border: [203, 213, 225] },
};

function nombreSeguro(str = "") {
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

function formatFechaLarga(iso) {
  const d = iso ? new Date(iso) : new Date();
  const base = isNaN(d.getTime()) ? new Date() : d;
  return base.toLocaleDateString("es-GT", { day: "numeric", month: "long", year: "numeric" });
}

function dibujarEncabezado(doc, titulo) {
  doc.setFillColor(...COLOR_PRIMARY);
  doc.rect(0, 0, PAGE_W, HEADER_H, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text("SmartFlow AI", MARGIN, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(200, 210, 230);
  const sub = doc.splitTextToSize(titulo || "Informe de eficiencia", CONTENT_W - 50);
  doc.text(sub[0] || "Informe de eficiencia", PAGE_W - MARGIN, 14, { align: "right" });
}

function dibujarPie(doc, pageNum, totalPages) {
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(`Página ${pageNum} de ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 10, { align: "right" });
  doc.text("Generado automáticamente por SmartFlow AI", MARGIN, PAGE_H - 10);
}

function nuevaPagina(doc, titulo) {
  doc.addPage();
  dibujarEncabezado(doc, titulo);
  return 32;
}

function checkPageBreak(doc, y, needed, titulo) {
  if (y + needed > PAGE_H - FOOTER_SAFE) {
    return nuevaPagina(doc, titulo);
  }
  return y;
}

// Interpreta el texto estructurado del reporte y lo maqueta con diseño corporativo
function escribirContenido(doc, texto, yInicial, titulo) {
  let y = yInicial;
  const lines = String(texto || "").split("\n");

  for (let raw of lines) {
    let line = raw.trim();

    if (!line) {
      y += 2.5;
      continue;
    }

    // 1. Separadores horizontales (---, ***, ___)
    if (/^[\-*_]{3,}$/.test(line)) {
      y = checkPageBreak(doc, y, 8, titulo);
      y += 2;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.line(MARGIN, y, PAGE_W - MARGIN, y);
      y += 6;
      continue;
    }

    // 2. Encabezados de Sección
    const headerMatch = line.match(/^(?:#{1,3}|\d+[\.\)])\s+(.+)$/);
    if (headerMatch) {
      const titleText = headerMatch[1].replace(/\*\*/g, "").trim();
      y = checkPageBreak(doc, y, 16, titulo);
      y += 4;

      doc.setFillColor(241, 245, 249);
      doc.roundedRect(MARGIN, y - 4, CONTENT_W, 8, 1.5, 1.5, "F");
      doc.setFillColor(...COLOR_ACCENT);
      doc.rect(MARGIN, y - 4, 2.5, 8, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...COLOR_PRIMARY);
      doc.text(titleText, MARGIN + 6, y + 1.5);
      y += 9;
      continue;
    }

    // 3. Viñetas / Listas (*, -, +)
    const bulletMatch = line.match(/^[\-\*\+]\s+(.+)$/);
    if (bulletMatch) {
      const bulletBody = bulletMatch[1].trim();
      const kvInBullet = bulletBody.match(/^\*\*(.+?)\*\*:?\s*(.*)$/);

      y = checkPageBreak(doc, y, 8, titulo);

      doc.setFillColor(...COLOR_ACCENT);
      doc.circle(MARGIN + 2, y - 1.2, 0.9, "F");

      if (kvInBullet) {
        const keyText = kvInBullet[1].replace(/\*\*/g, "").trim();
        const valText = kvInBullet[2].replace(/\*\*/g, "").trim();
        const keyFormatted = keyText.endsWith(":") ? keyText : `${keyText}:`;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(...COLOR_PRIMARY);
        const keyWidth = doc.getTextWidth(`${keyFormatted} `);

        doc.text(keyFormatted, MARGIN + 6, y);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(...COLOR_TEXT);

        if (valText) {
          const availW = CONTENT_W - 8 - keyWidth;
          if (availW > 40) {
            const valWrapped = doc.splitTextToSize(valText, availW);
            doc.text(valWrapped[0], MARGIN + 6 + keyWidth, y);
            if (valWrapped.length > 1) {
              const rest = doc.splitTextToSize(valWrapped.slice(1).join(" "), CONTENT_W - 8);
              y += 4.6;
              doc.text(rest, MARGIN + 6, y);
              y += (rest.length - 1) * 4.6;
            }
          } else {
            const valWrappedFull = doc.splitTextToSize(valText, CONTENT_W - 8);
            y += 4.6;
            doc.text(valWrappedFull, MARGIN + 6, y);
            y += (valWrappedFull.length - 1) * 4.6;
          }
        }
        y += 5;
      } else {
        const cleanText = bulletBody.replace(/\*\*/g, "");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(...COLOR_TEXT);
        const wrapped = doc.splitTextToSize(cleanText, CONTENT_W - 8);
        y = checkPageBreak(doc, y, wrapped.length * 4.6, titulo);
        doc.text(wrapped, MARGIN + 6, y);
        y += wrapped.length * 4.6 + 1.5;
      }
      continue;
    }

    // 4. Pares Clave-Valor sin viñeta
    const kvMatch = line.match(/^\*\*(.+?)\*\*:?\s*(.*)$/);
    if (kvMatch) {
      const keyText = kvMatch[1].replace(/\*\*/g, "").trim();
      const valText = kvMatch[2].replace(/\*\*/g, "").trim();
      const keyFormatted = keyText.endsWith(":") ? keyText : `${keyText}:`;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...COLOR_PRIMARY);
      const keyWidth = doc.getTextWidth(`${keyFormatted} `);

      y = checkPageBreak(doc, y, 6, titulo);
      doc.text(keyFormatted, MARGIN, y);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLOR_TEXT);
      if (valText) {
        const valWrapped = doc.splitTextToSize(valText, CONTENT_W - keyWidth);
        doc.text(valWrapped[0], MARGIN + keyWidth, y);
        if (valWrapped.length > 1) {
          const rest = doc.splitTextToSize(valWrapped.slice(1).join(" "), CONTENT_W);
          y += 4.6;
          doc.text(rest, MARGIN, y);
          y += (rest.length - 1) * 4.6;
        }
      }
      y += 5;
      continue;
    }

    // 5. Párrafo normal
    const cleanLine = line.replace(/\*\*/g, "");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...COLOR_TEXT);
    const wrapped = doc.splitTextToSize(cleanLine, CONTENT_W);
    y = checkPageBreak(doc, y, wrapped.length * 4.6, titulo);
    doc.text(wrapped, MARGIN, y);
    y += wrapped.length * 4.6 + 2;
  }

  return y;
}

// Dibuja el diagrama del flujo totalmente centrado y estilizado
function dibujarFlujo(doc, flow, titulo) {
  if (!flow?.nodes?.length) return;

  const geometry = layoutFlowGeometry(flow.nodes, flow.edges || []);
  if (!geometry.nodes.length) return;

  let y = nuevaPagina(doc, titulo);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text("Diagrama del flujo", MARGIN, y);
  y += 10;

  // Escala y cálculo de centrado horizontal exacto
  const scale = Math.min(CONTENT_W / Math.max(geometry.width, 1), 1);
  const pxToMm = (px) => px * scale;
  const scaledWidth = geometry.width * scale;
  const originX = MARGIN + Math.max(0, (CONTENT_W - scaledWidth) / 2);

  const pageUsableH = PAGE_H - FOOTER_SAFE - y;
  const stripHeightPx = pageUsableH / scale;

  let offsetY = 0;
  let pageIndex = 0;

  while (offsetY < geometry.height && pageIndex < 10) {
    let originY = y;
    if (pageIndex > 0) {
      originY = nuevaPagina(doc, titulo);
    }

    // Dibujar Conexiones/Líneas
    geometry.edges.forEach((e) => {
      const pts = e.points || [];
      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];
        if (p1.y - offsetY < -40 && p2.y - offsetY < -40) continue;
        if (p1.y - offsetY > stripHeightPx + 40 && p2.y - offsetY > stripHeightPx + 40) continue;
        
        doc.setDrawColor(148, 163, 184);
        doc.setLineWidth(0.35);
        doc.line(
          originX + pxToMm(p1.x),
          originY + pxToMm(p1.y - offsetY),
          originX + pxToMm(p2.x),
          originY + pxToMm(p2.y - offsetY)
        );
      }

      // Dibujar etiqueta de decisión ("Sí", "No") con fondo blanco para que no la cruce la línea
      if (e.label && pts.length) {
        const midIndex = Math.floor(pts.length / 2);
        const mid = pts[midIndex];
        if (mid && mid.y - offsetY >= -20 && mid.y - offsetY <= stripHeightPx + 20) {
          const lx = originX + pxToMm(mid.x);
          const ly = originY + pxToMm(mid.y - offsetY);

          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          doc.setTextColor(100, 116, 139);
          
          const tw = doc.getTextWidth(e.label);
          doc.setFillColor(255, 255, 255);
          doc.rect(lx - tw / 2 - 1.5, ly - 2.5, tw + 3, 4, "F");
          doc.text(e.label, lx, ly + 0.5, { align: "center" });
        }
      }
    });

    // Dibujar Nodos
    geometry.nodes.forEach((n) => {
      if (n.y + n.height < offsetY - 5 || n.y > offsetY + stripHeightPx + 5) return;
      const colors = NODE_COLORS[n.type] || NODE_COLORS.paso;
      const x = originX + pxToMm(n.x);
      const yN = originY + pxToMm(n.y - offsetY);
      const w = pxToMm(n.width);
      const h = pxToMm(n.height);

      // Caja del nodo
      doc.setFillColor(...colors.fill);
      doc.setDrawColor(...colors.border);
      doc.setLineWidth(0.4);
      doc.roundedRect(x, yN, w, h, 2, 2, "FD");

      // Texto interno del nodo
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...colors.text);

      const maxTextW = Math.max(w - 4, 8);
      const wrapped = doc.splitTextToSize(n.label || "", maxTextW);
      const lineHeight = 3.2;
      const maxLines = Math.max(1, Math.floor((h - 2) / lineHeight));
      const shown = wrapped.slice(0, maxLines);

      const totalTextH = shown.length * lineHeight;
      const startTy = yN + (h - totalTextH) / 2 + 2.2;

      shown.forEach((ln, i) => {
        doc.text(ln, x + w / 2, startTy + i * lineHeight, { align: "center" });
      });
    });

    offsetY += stripHeightPx;
    pageIndex += 1;
  }
}

export function buildReportDoc({ titulo, texto, generatedEn, ahorroHoras, flow }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const tituloFinal = titulo || "Reporte de eficiencia";

  dibujarEncabezado(doc, tituloFinal);
  let y = 34;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...COLOR_PRIMARY);
  const tituloWrapped = doc.splitTextToSize(tituloFinal, CONTENT_W);
  doc.text(tituloWrapped, MARGIN, y);
  y += tituloWrapped.length * 7 + 2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(`Generado el ${formatFechaLarga(generatedEn)}`, MARGIN, y);
  y += 8;

  if (ahorroHoras !== undefined && ahorroHoras !== null && ahorroHoras !== "") {
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(0.4);
    doc.roundedRect(MARGIN, y, 64, 11, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(6, 95, 70);
    doc.text(`Ahorro estimado: ${ahorroHoras} hrs`, MARGIN + 32, y + 7, { align: "center" });
    y += 18;
  } else {
    y += 2;
  }

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 8;

  y = escribirContenido(doc, texto, y, tituloFinal);
  dibujarFlujo(doc, flow, tituloFinal);

  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    dibujarPie(doc, p, totalPages);
  }

  return doc;
}

/** Devuelve { blob, filename } listo para vista previa o descarga */
export function crearReportePDF(opts) {
  const doc = buildReportDoc(opts);
  return {
    blob: doc.output("blob"),
    filename: `reporte-eficiencia-${nombreSeguro(opts.titulo) || "flujo"}.pdf`,
  };
}