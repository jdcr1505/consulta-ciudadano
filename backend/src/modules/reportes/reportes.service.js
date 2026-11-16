export const COLUMNAS_OPCIONALES = ['resultado', 'ultimaConsulta'];

/**
 * HU16 — Selección de la información del reporte (criterios + vista previa).
 * Opción A aprobada: una fila por ciudadano activo; «Resultado» = estado vigente del ciudadano.
 * Siempre incluye identificación, nombres y apellidos; el resto es opcional. Datos mínimos necesarios.
 */
export function createReportesService({ prisma, audit }) {
  return {
    async vistaPrevia(usuario, { estado, columnas, page, pageSize }, ip) {
      const where = { activo: true, ...(estado !== 'TODOS' && { estadoJudicial: estado }) };
      const [filas, total, porEstado] = await Promise.all([
        prisma.ciudadano.findMany({
          where,
          orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: { id: true, identificacion: true, nombres: true, apellidos: true, estadoJudicial: true },
        }),
        prisma.ciudadano.count({ where }),
        prisma.ciudadano.groupBy({ by: ['estadoJudicial'], where: { activo: true }, _count: { _all: true } }),
      ]);

      let ultimas = new Map();
      if (columnas.includes('ultimaConsulta') && filas.length) {
        const g = await prisma.consulta.groupBy({ by: ['ciudadanoId'], where: { ciudadanoId: { in: filas.map((f) => f.id) } }, _max: { fechaHora: true } });
        ultimas = new Map(g.map((x) => [x.ciudadanoId, x._max.fechaHora]));
      }

      const cuenta = (e) => porEstado.find((x) => x.estadoJudicial === e)?._count._all ?? 0;
      await audit.registrar({ usuarioId: usuario.id, accion: 'REPORTE_VISTA_PREVIA', ip, detalle: { estado, columnas, page } });
      return {
        criterios: { estado, columnas },
        resumen: { total: cuenta('REQUERIDO') + cuenta('NO_REQUERIDO'), requeridos: cuenta('REQUERIDO'), noRequeridos: cuenta('NO_REQUERIDO') },
        items: filas.map((f) => ({
          identificacion: f.identificacion,
          nombres: f.nombres,
          apellidos: f.apellidos,
          ...(columnas.includes('resultado') && { resultado: f.estadoJudicial }),
          ...(columnas.includes('ultimaConsulta') && { ultimaConsulta: ultimas.get(f.id) ?? null }),
        })),
        total,
        page,
        pageSize,
      };
    },
  };
}
