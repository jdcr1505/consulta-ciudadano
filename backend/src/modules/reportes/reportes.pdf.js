import PDFDocument from 'pdfkit';

const AZUL = '#0b3135';
const GRIS = '#53676b';
const LINEA = '#d5dddb';
const ENCABEZADO_FONDO = '#e9eeed';

const ETIQUETAS_ESTADO = { TODOS: 'Todos los ciudadanos', REQUERIDO: 'Solo requeridos', NO_REQUERIDO: 'Solo no requeridos' };
const COLUMNAS = {
  identificacion: { titulo: 'Identificación', ancho: 90 },
  nombres: { titulo: 'Nombres', ancho: 150 },
  apellidos: { titulo: 'Apellidos', ancho: 150 },
  resultado: { titulo: 'Resultado', ancho: 90 },
  ultimaConsulta: { titulo: 'Última consulta', ancho: 130 },
};

const fechaCorta = (d) => (d ? new Date(d).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' }) : 'Nunca');

/**
 * HU17 — Genera el PDF del reporte de ciudadanos. Incluye encabezado, fecha de generación, filtros aplicados,
 * tabla con el encabezado repetido en cada página y paginación «Página x de y».
 * Devuelve un Buffer. Siempre incluye identificación, nombres y apellidos.
 */
export function construirPdf({ estado, columnas, filas, total, generadoEn, generadoPor }) {
  const campos = ['identificacion', 'nombres', 'apellidos', ...columnas];
  const ancho = campos.reduce((a, c) => a + COLUMNAS[c].ancho, 0);
  const horizontal = ancho > 495; // ancho útil de una A4 vertical con márgenes de 50
  const doc = new PDFDocument({
    size: 'A4',
    layout: horizontal ? 'landscape' : 'portrait',
    margin: 50,
    bufferPages: true,
    compress: process.env.PDF_COMPRESS !== 'false',
    info: { Title: 'Reporte de ciudadanos', Author: 'Registraduría Konrad Lorenz', Subject: 'Sistema de Consulta Ciudadano (proyecto académico, datos ficticios)' },
  });
  const trozos = [];
  doc.on('data', (c) => trozos.push(c));
  const terminado = new Promise((resolve, reject) => { doc.on('end', () => resolve(Buffer.concat(trozos))); doc.on('error', reject); });

  const izq = doc.page.margins.left;
  const util = doc.page.width - izq - doc.page.margins.right;
  const factor = util / ancho; // reparte el ancho disponible entre las columnas
  const anchos = campos.map((c) => COLUMNAS[c].ancho * factor);
  const limiteInferior = () => doc.page.height - doc.page.margins.bottom - 24;

  const encabezadoTabla = () => {
    const y = doc.y;
    doc.rect(izq, y, util, 20).fill(ENCABEZADO_FONDO);
    let x = izq;
    doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(9);
    campos.forEach((c, i) => { doc.text(COLUMNAS[c].titulo, x + 6, y + 6, { width: anchos[i] - 8, lineBreak: false }); x += anchos[i]; });
    doc.y = y + 22;
  };

  // Cabecera del documento
  doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(16).text('Registraduría Konrad Lorenz', izq, 50);
  doc.font('Helvetica').fontSize(10).fillColor(GRIS).text('Sistema de Consulta Ciudadano');
  doc.moveDown(0.8).fillColor(AZUL).font('Helvetica-Bold').fontSize(14).text('Reporte de ciudadanos');
  doc.moveDown(0.4).font('Helvetica').fontSize(9).fillColor('#13262a');
  doc.text(`Fecha de generación: ${fechaCorta(generadoEn)}`);
  doc.text(`Generado por: ${generadoPor}`);
  doc.text(`Filtro de estado: ${ETIQUETAS_ESTADO[estado]}`);
  doc.text(`Total de ciudadanos en el reporte: ${total}`);
  doc.moveDown(0.8);
  doc.moveTo(izq, doc.y).lineTo(izq + util, doc.y).strokeColor(LINEA).stroke();
  doc.moveDown(0.6);

  encabezadoTabla();
  doc.font('Helvetica').fontSize(9);
  filas.forEach((f, n) => {
    if (doc.y + 18 > limiteInferior()) { doc.addPage(); doc.y = doc.page.margins.top; encabezadoTabla(); doc.font('Helvetica').fontSize(9); }
    const y = doc.y;
    if (n % 2 === 1) doc.rect(izq, y - 2, util, 18).fill('#f5f8f7');
    let x = izq;
    doc.fillColor('#13262a');
    campos.forEach((c, i) => {
      const v = c === 'resultado' ? (f.resultado === 'REQUERIDO' ? 'Requerido' : 'No requerido') : c === 'ultimaConsulta' ? fechaCorta(f.ultimaConsulta) : f[c];
      doc.text(String(v ?? ''), x + 6, y + 2, { width: anchos[i] - 8, lineBreak: false, ellipsis: true });
      x += anchos[i];
    });
    doc.y = y + 18;
  });
  if (filas.length === 0) {
    doc.fillColor(GRIS).fontSize(10).text('No hay ciudadanos que cumplan los criterios seleccionados.', izq, doc.y + 8);
  }

  // Pie de página en todas las hojas: aviso de simulación y «Página x de y».
  const rango = doc.bufferedPageRange();
  for (let i = 0; i < rango.count; i++) {
    doc.switchToPage(rango.start + i);
    const yPie = doc.page.height - 40;
    doc.page.margins.bottom = 0; // permite escribir en el margen inferior sin crear páginas nuevas
    doc.font('Helvetica').fontSize(8).fillColor(GRIS);
    doc.text('Sistema académico con datos ficticios', izq, yPie, { width: util / 2, lineBreak: false });
    doc.text(`Página ${i + 1} de ${rango.count}`, izq + util / 2, yPie, { width: util / 2, align: 'right', lineBreak: false });
  }
  doc.end();
  return terminado;
}