import { AppError, badRequest } from '../../common/errors.js';

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

// Filtros del historial. «NO_REQUERIDO» incluye a quienes no figuran en el sistema (regla de negocio);
// «NO_REGISTRADO» permite aislar solo esas consultas.
const RESULTADOS_FILTRO = {
  REQUERIDO: ['REQUERIDO'],
  NO_REQUERIDO: ['NO_REQUERIDO', 'NO_ENCONTRADO'],
  NO_REGISTRADO: ['NO_ENCONTRADO'],
};

export function consultaDTO(c, conFuncionario = false) {
  return {
    id: c.id,
    fechaHora: c.fechaHora,
    identificacion: c.identificacionConsultada,
    resultado: c.resultado === 'NO_ENCONTRADO' ? 'NO_REQUERIDO' : c.resultado,
    registrado: c.resultado !== 'NO_ENCONTRADO',
    origen: c.origen,
    ciudadano: c.ciudadano ? { nombres: c.ciudadano.nombres, apellidos: c.ciudadano.apellidos } : null,
    ...(conFuncionario && c.usuario && { funcionario: { id: c.usuario.id, identificacion: c.usuario.identificacion, nombres: c.usuario.nombres, apellidos: c.usuario.apellidos } }),
  };
}

/** Variantes con ceros a la izquierda (hasta 10 dígitos) para encontrar identificaciones almacenadas con relleno. */
export const variantesConCeros = (n) => Array.from({ length: 10 - n.length + 1 }, (_, i) => n.padStart(n.length + i, '0'));

/**
 * HU04 (buscar), HU05 (datos mínimos a mostrar) y HU06 (registrar la consulta).
 * Regla de negocio: quien NO figura en el sistema se considera NO REQUERIDO (no hay requerimiento registrado).
 * La consulta se guarda internamente como NO_ENCONTRADO para poder distinguirla en el historial y las estadísticas.
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
        const candidatos = await prisma.ciudadano.findMany({ where: { identificacion: { in: variantesConCeros(n) } }, orderBy: { id: 'asc' } });
        // Desactivar un ciudadano (HU14) lo oculta de listados y reportes, pero NO cambia lo que dice la consulta:
        // un registro «requerido» desactivado nunca debe pasar a «no requerido».
        const ciudadano = candidatos.find((c) => c.identificacion === n) ?? candidatos[0] ?? null;

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

        return {
          consulta: { id: registro.id, fechaHora: registro.fechaHora },
          resultado: ciudadano ? ciudadano.estadoJudicial : 'NO_REQUERIDO',
          registrado: Boolean(ciudadano),
          // Datos mínimos necesarios para el funcionario (minimización de datos personales).
          ciudadano: ciudadano ? { identificacion: ciudadano.identificacion, nombres: ciudadano.nombres, apellidos: ciudadano.apellidos } : null,
        };
      } catch (e) {
        if (esErrorDeConexion(e)) {
          throw new AppError(503, 'SERVICIO_NO_DISPONIBLE', 'El servicio de consulta no está disponible. Intente de nuevo. Esto NO significa que el ciudadano no sea requerido.');
        }
        throw e;
      }
    },

    // ---------- HU07: historial de consultas ----------
    /**
     * El funcionario ve SOLO las suyas (permiso consultas:leer); el administrador ve todas (consultas:leer_todas)
     * y puede filtrar por funcionario. Cada acceso al historial completo queda auditado.
     */
    async listar(usuario, filtros, ip) {
      const { resultado, desde, hasta, identificacion, usuarioId, page, pageSize } = filtros;
      const todas = usuario.permisos.has('consultas:leer_todas');
      const where = {
        ...(todas ? (usuarioId && { usuarioId }) : { usuarioId: usuario.id }),
        ...(resultado && { resultado: { in: RESULTADOS_FILTRO[resultado] } }),
        ...(identificacion && { identificacionConsultada: { startsWith: identificacion } }),
        ...((desde || hasta) && {
          fechaHora: {
            ...(desde && { gte: new Date(`${desde}T00:00:00-05:00`) }), // día calendario de Colombia (UTC−5)
            ...(hasta && { lte: new Date(`${hasta}T23:59:59.999-05:00`) }),
          },
        }),
      };
      const [filas, total] = await Promise.all([
        prisma.consulta.findMany({
          where,
          orderBy: [{ fechaHora: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            ciudadano: { select: { nombres: true, apellidos: true } },
            ...(todas && { usuario: { select: { id: true, identificacion: true, nombres: true, apellidos: true } } }),
          },
        }),
        prisma.consulta.count({ where }),
      ]);
      if (todas) await audit.registrar({ usuarioId: usuario.id, accion: 'HISTORIAL_CONSULTAS', ip, detalle: { total } });
      return { items: filas.map((c) => consultaDTO(c, todas)), total, page, pageSize };
    },
  };
}