import * as pdfjsLib from "pdfjs-dist";
import { jsPDF } from "jspdf";

// Cargar el worker directamente desde CDN usando la versión exacta instalada.
// Esto elimina de raíz el error de "Failed to fetch dynamically imported module" en Cloud Run.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const MAX_CHARS = 15000; // Límite para no saturar a la IA

// Lee un PDF en el navegador y devuelve todo su texto
export async function extractPdfText(file) {
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  let texto = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let pageText = "";
    for (const item of content.items) {
      pageText += item.str;
      pageText += item.hasEOL ? "\n" : " ";
    }
    texto += pageText + "\n\n";
    if (texto.length >= MAX_CHARS) break;
  }

  return texto
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_CHARS);
}

// Genera nombres de archivo limpios y sin caracteres especiales
export function nombreSeguro(str) {
  return (str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Construye la estructura básica del documento PDF
export function buildReportDoc(opts = {}) {
  const doc = new jsPDF();
  const titulo = opts.titulo || "Reporte de Eficiencia de Flujo";

  doc.setFontSize(16);
  doc.text(titulo, 14, 20);

  if (opts.subtitulo) {
    doc.setFontSize(11);
    doc.text(opts.subtitulo, 14, 28);
  }

  if (opts.resumen) {
    doc.setFontSize(10);
    doc.text(opts.resumen, 14, 38);
  }

  return doc;
}

/** Devuelve { blob, filename } listo para vista previa (iframe) o descarga. */
export function crearReportePDF(opts) {
  const doc = buildReportDoc(opts);
  return {
    blob: doc.output("blob"),
    filename: `reporte-eficiencia-${nombreSeguro(opts.titulo) || "flujo"}.pdf`,
  };
}c