import { Router } from 'express';
import { validate } from '../../common/validate.js';
import { idParam } from '../../common/fields.js';
import { notFound } from '../../common/errors.js';

export function createCatalogosRouter({ prisma }) {
  const router = Router();

  router.get('/fuerzas', async (_req, res) => {
    const fuerzas = await prisma.fuerzaPublica.findMany({
      orderBy: { id: 'asc' },
      include: { rangos: { orderBy: { id: 'asc' }, select: { id: true, nombre: true } } },
    });
    res.json({ fuerzas: fuerzas.map((f) => ({ id: f.id, nombre: f.nombre, rangos: f.rangos })) });
  });

  router.get('/fuerzas/:id/rangos', validate({ params: idParam }), async (req, res) => {
    const fuerza = await prisma.fuerzaPublica.findUnique({ where: { id: req.params.id } });
    if (!fuerza) throw notFound('FUERZA_NO_ENCONTRADA', 'Fuerza pública no encontrada');
    const rangos = await prisma.rango.findMany({ where: { fuerzaPublicaId: fuerza.id }, orderBy: { id: 'asc' }, select: { id: true, nombre: true } });
    res.json({ rangos });
  });

  return router;
}
