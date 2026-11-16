// Auditoría de operaciones sensibles. Nunca se guardan contraseñas ni tokens.
const PROHIBIDOS = /pass|token|secret|hash/i;

function limpiar(obj) {
  if (!obj || typeof obj !== 'object') return obj ?? undefined;
  return Object.fromEntries(Object.entries(obj).filter(([k]) => !PROHIBIDOS.test(k)));
}

export function createAuditService(prisma) {
  return {
    /** `db` permite registrar dentro de una transacción (tx) o usar el cliente por defecto. */
    registrar({ usuarioId = null, accion, entidad, entidadId, resultado = 'OK', ip, detalle }, db = prisma) {
      return db.auditoria.create({
        data: {
          usuarioId,
          accion,
          entidad,
          entidadId: entidadId === undefined || entidadId === null ? undefined : String(entidadId),
          resultado,
          ip: ip ?? undefined,
          detalle: limpiar(detalle),
        },
      });
    },
  };
}
