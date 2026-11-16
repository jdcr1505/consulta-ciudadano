import { AppError, badRequest, notFound } from '../../common/errors.js';

const CODIGOS_CONEXION = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', '57P01', '08006', '08001']);

/** ¿El error indica que la base de datos no está disponible? (no confundir con "ciudadano no encontrado"). */
export function esErrorDeConexion(e) {
  if (!e || e instanceof AppError) return false;
  return (
    CODIGOS_CONEXION.has(e.code) ||
    e.name === 'PrismaClientInitializationError' ||
    /can't reach database|connection terminated|ECONNREFUSED|connection timeout|timed out/i.test(e.message ?? '')
  );
}

/**
 * Los códigos de barras suelen rellenar el número con ceros a la izquierda (p. ej. 0001012345).
 * Se quitan los ceros de relleno y se valida: solo dígitos, 6 a 10.
 */
export function normalizarIdentificacion(entrada) {
  const s = String(entrada ?? '').trim();
  if (!/^[0-9]+$/.test(s)) return null;
  const n = s.replace(/^0+/, '');
  return /^[0-9]{6,10}$/.test(n) ? n : null;
}

/** Variantes con ceros a la izquierda (hasta 10 dígitos) para encontrar identificaciones almacenadas con relleno. */
export const variantesConCeros = (n) => Array.from({ length: 10 - n.length + 1 }, (_, i) => n.padStart(n.length + i, '0'));

/**
 * HU04 (buscar), HU05 (datos mínimos a mostrar) y HU06 (registrar la consulta).
 * Un error de conexión NUNCA se interpreta como «No requerido»: responde 503 y no registra resultado alguno.
 */
export function createConsultasService({ prisma, audit }) {
  return {
    async consultar(usuario, { identificacion, origen }, ip) {
      const n = normalizarIdentificacion(identificacion);
      if (!n) {
        await audit.registrar({ usuarioId: usuario.id, accion: 'CONSULTA', resultado: 'INVALIDA', ip }).catch(() => {});
        throw badRequest('IDENTIFICACION_INVALIDA', 'La identificación debe tener entre 6 y 10 dígitos numéricos');
      }
      try {
        const candidatos = await prisma.ciudadano.findMany({ where: { identificacion: { in: variantesConCeros(n) } } });
        // Un ciudadano desactivado no está disponible para consultas (HU14).
        const ciudadano = candidatos.find((c) => c.activo && c.identificacion === n) ?? candidatos.find((c) => c.activo) ?? null;

        const registro = await prisma.$transaction(async (tx) => {
          const c = await tx.consulta.create({
            data: {
              usuarioId: usuario.id,
              ciudadanoId: ciudadano?.id ?? null,
              identificacionConsultada: n,
              resultado: ciudadano ? ciudadano.estadoJudicial : 'NO_ENCONTRADO',
              origen,
            },
          });
          await audit.registrar(
            { usuarioId: usuario.id, accion: 'CONSULTA', entidad: 'consulta', entidadId: c.id, ip, detalle: { resultado: c.resultado, origen } },
            tx,
          );
          return c;
        });

        if (!ciudadano) throw notFound('CIUDADANO_NO_ENCONTRADO', 'No hay un ciudadano registrado con esa identificación');
        return {
          consulta: { id: registro.id, fechaHora: registro.fechaHora },
          resultado: registro.resultado,
          // Datos mínimos necesarios para el funcionario (minimización de datos personales).
          ciudadano: { identificacion: ciudadano.identificacion, nombres: ciudadano.nombres, apellidos: ciudadano.apellidos },
        };
      } catch (e) {
        if (esErrorDeConexion(e)) {
          throw new AppError(503, 'SERVICIO_NO_DISPONIBLE', 'El servicio de consulta no está disponible. Intente de nuevo. Esto NO significa que el ciudadano no sea requerido.');
        }
        throw e;
      }
    },
  };
}
