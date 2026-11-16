import { Router } from 'express';
import { z } from 'zod';
import { paginacion } from '../../common/fields.js';
import { validate } from '../../common/validate.js';
import { authorize } from '../../security/authenticate.js';
import { COLUMNAS_OPCIONALES } from './reportes.service.js';

const vistaPreviaSchema = {
  query: z.object({
    estado: z.enum(['TODOS', 'REQUERIDO', 'NO_REQUERIDO'], { error: 'El estado debe ser TODOS, REQUERIDO o NO_REQUERIDO' }).default('TODOS'),
    columnas: z
      .string()
      .optional()
      .transform((s) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []))
      .pipe(z.array(z.enum(COLUMNAS_OPCIONALES, { error: 'Columna no disponible' }))),
    ...paginacion,
  }),
};

export function createReportesRouter({ service }) {
  const router = Router();
  router.get('/ciudadanos/vista-previa', authorize('reportes:leer'), validate(vistaPreviaSchema), async (req, res) => {
    res.json(await service.vistaPrevia(req.user, req.validQuery, req.ip));
  });
  return router;
}
