import { badRequest } from '../../common/errors.js';
import { VARIANTES } from '../../integrations/ocr/TesseractMrzOcr.js';
import { huellaMrz, interpretarMrz } from './mrz.js';

const MAX_BYTES = 3 * 1024 * 1024;
const esJpeg = (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const esPng = (b) => b.length > 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;

/**
 * Lee la MRZ de la cédula digital a partir de una fotografía del reverso.
 * Privacidad: la imagen vive solo en memoria durante la petición; no se guarda ni se audita su contenido.
 */
export function createDocumentosService({ ocr, audit }) {
  return {
    async leerMrz(usuarioId, imagenBase64, ip) {
      const limpio = String(imagenBase64 ?? '').replace(/^data:image\/[a-z]+;base64,/i, '');
      const buffer = Buffer.from(limpio, 'base64');
      if (!buffer.length || buffer.length > MAX_BYTES || !(esJpeg(buffer) || esPng(buffer))) {
        throw badRequest('IMAGEN_INVALIDA', 'La imagen debe ser JPEG o PNG de máximo 3 MB');
      }
      if (!ocr) throw badRequest('OCR_NO_DISPONIBLE', 'La lectura de MRZ no está habilitada en el servidor');

      let ultimo = { valido: false, motivo: 'MRZ_NO_ENCONTRADA' };
      let huella = [];
      let intentos = 0;
      const votos = new Map(); // lecturas de confianza media: número → {veces, metodo}
      const respuesta = async (identificacion, confianza, metodo) => {
        await audit.registrar({ usuarioId, accion: 'LECTURA_MRZ', resultado: 'OK', ip, detalle: { metodo, confianza, intentos } });
        return { valido: true, identificacion, confianza, metodo, intentos };
      };
      try {
        for (const variante of VARIANTES) {
          intentos += 1;
          const texto = await ocr.leerTexto(buffer, variante);
          const r = interpretarMrz(texto);
          if (r.valido && r.confianza === 'alta') return await respuesta(r.identificacion, 'alta', r.metodo);
          if (r.valido) {
            // Confianza media: si dos variantes distintas de la imagen coinciden en el número, se considera confiable.
            const v = votos.get(r.identificacion) ?? { veces: 0, metodo: r.metodo };
            v.veces += 1;
            votos.set(r.identificacion, v);
            if (v.veces >= 2) return await respuesta(r.identificacion, 'alta', 'consenso');
            continue;
          }
          // Se conserva el mejor diagnóstico: preferir "dígito de control inválido" (se encontró estructura).
          if (r.motivo === 'DIGITO_CONTROL_INVALIDO' || ultimo.motivo === 'MRZ_NO_ENCONTRADA') { ultimo = r; huella = huellaMrz(texto); }
        }
      } catch (e) {
        if (e?.status) throw e;
        throw badRequest('IMAGEN_INVALIDA', 'No se pudo procesar la imagen. Intente con otra fotografía');
      }
      if (votos.size) {
        // Sin confianza alta: se entrega el número más repetido, marcado como "media" para que se verifique con cuidado.
        const [numero, v] = [...votos.entries()].sort((x, y) => y[1].veces - x[1].veces)[0];
        return respuesta(numero, 'media', v.metodo);
      }
      await audit.registrar({ usuarioId, accion: 'LECTURA_MRZ', resultado: 'FALLIDO', ip, detalle: { motivo: ultimo.motivo, intentos } });
      // La huella solo contiene la forma (9 = dígito, A = letra), nunca los datos leídos.
      return { valido: false, motivo: ultimo.motivo, intentos, huella };
    },
  };
}