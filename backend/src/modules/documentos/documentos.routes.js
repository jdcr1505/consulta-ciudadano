import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { forbidden } from '../../common/errors.js';
import { validate } from '../../common/validate.js';

export function createDocumentosRouter({ cfg, service }) {
  const router = Router();
  const limiter = rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => !cfg.rateLimitEnabled,
    keyGenerator: (req) => `u${req.user.id}`,
    handler: (_req, res) => res.status(429).json({ error: { code: 'DEMASIADAS_PETICIONES', message: 'Demasiadas lecturas. Espere un momento' } }),
  });
  const permiso = (req, _res, next) =>
    req.user.permisos.has('consultas:crear') ? next() : next(forbidden('CONSULTA_NO_AUTORIZADA', 'No está autorizado para realizar consultas'));

  router.post('/mrz', permiso, limiter, validate({ body: z.object({ imagen: z.string({ error: 'La imagen es obligatoria' }).min(100, 'La imagen es obligatoria') }) }), async (req, res) => {
    res.json(await service.leerMrz(req.user.id, req.body.imagen, req.ip));
  });
  return router;
}
