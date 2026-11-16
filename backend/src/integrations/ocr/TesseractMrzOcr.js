import path from 'node:path';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';

const require = createRequire(import.meta.url);

/** Variantes de preprocesado que se prueban en orden hasta obtener un MRZ con dígitos de control válidos. */
export const VARIANTES = ['completa', 'inferior', 'umbral'];

/**
 * OCR de la zona MRZ con Tesseract (en el servidor). La imagen se procesa SOLO en memoria: no se escribe en disco
 * ni se registra. Contrato: leerTexto(buffer, variante) -> Promise<string>.
 */
export class TesseractMrzOcr {
  constructor() {
    this.workerPromise = null;
    this.cola = Promise.resolve();
  }

  #worker() {
    this.workerPromise ??= (async () => {
      const langPath = path.join(path.dirname(require.resolve('@tesseract.js-data/eng')), '4.0.0_best_int');
      const w = await createWorker('eng', 1, { langPath, gzip: true, cachePath: path.resolve('.ocr-cache') });
      await w.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<', tessedit_pageseg_mode: '6' });
      return w;
    })();
    return this.workerPromise;
  }

  async #preparar(buffer, variante) {
    let img = sharp(buffer, { limitInputPixels: 40_000_000 }).rotate(); // respeta la orientación EXIF
    const { width, height } = await img.metadata();
    if (variante === 'inferior') {
      // La MRZ está en la parte baja del reverso: se recorta ese 55 % y se amplía.
      img = sharp(await img.extract({ left: 0, top: Math.floor(height * 0.45), width, height: height - Math.floor(height * 0.45) }).toBuffer());
    }
    img = img.resize({ width: 2000, withoutEnlargement: false }).grayscale().normalise().sharpen();
    if (variante === 'umbral') img = img.threshold(150);
    return img.png().toBuffer();
  }

  leerTexto(buffer, variante = 'completa') {
    // Un worker procesa un trabajo a la vez: se encolan las solicitudes.
    const tarea = this.cola.then(async () => {
      const imagen = await this.#preparar(buffer, variante);
      const w = await this.#worker();
      const { data } = await w.recognize(imagen);
      return data.text;
    });
    this.cola = tarea.catch(() => {});
    return tarea;
  }

  async cerrar() {
    if (this.workerPromise) await (await this.workerPromise).terminate();
  }
}
