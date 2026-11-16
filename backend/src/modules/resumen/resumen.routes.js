import { Router } from 'express';

// Indicadores de la pantalla de inicio de la web; cada bloque se incluye solo si el rol tiene el permiso.
export function createResumenRouter({ prisma }) {
  const router = Router();

  router.get('/', async (req, res) => {
    const p = req.user.permisos;
    const salida = {};
    if (p.has('ciudadanos:leer')) {
      const g = await prisma.ciudadano.groupBy({ by: ['estadoJudicial'], where: { activo: true }, _count: { _all: true } });
      const n = (e) => g.find((x) => x.estadoJudicial === e)?._count._all ?? 0;
      salida.ciudadanos = { total: n('REQUERIDO') + n('NO_REQUERIDO'), requeridos: n('REQUERIDO'), noRequeridos: n('NO_REQUERIDO') };
    }
    if (p.has('usuarios:leer')) {
      const g = await prisma.usuario.groupBy({ by: ['estado'], _count: { _all: true } });
      const n = (e) => g.find((x) => x.estado === e)?._count._all ?? 0;
      salida.usuarios = { activos: n('ACTIVO'), inactivos: n('INACTIVO') };
    }
    if (p.has('consultas:leer_todas')) {
      const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
      const desde = new Date(`${hoy}T00:00:00-05:00`); // Colombia: UTC-5 todo el año
      const g = await prisma.consulta.groupBy({ by: ['resultado'], where: { fechaHora: { gte: desde } }, _count: { _all: true } });
      const n = (e) => g.find((x) => x.resultado === e)?._count._all ?? 0;
      salida.consultasHoy = { total: n('REQUERIDO') + n('NO_REQUERIDO') + n('NO_ENCONTRADO'), requeridos: n('REQUERIDO'), noEncontrados: n('NO_ENCONTRADO') };
    }
    res.json(salida);
  });
  return router;
}
