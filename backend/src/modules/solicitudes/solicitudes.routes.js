import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../../common/validate.js';
import { crearSolicitudSchema } from './solicitudes.schemas.js';

export function createSolicitudesRouter({ cfg, service }) {
  const router = Router();
  const limiter = rateLimit({
    windowMs: 60 * 60_000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => !cfg.rateLimitEnabled,
    handler: (_req, res) =>
      res.status(429).json({ error: { code: 'DEMASIADAS_PETICIONES', message: 'Demasiadas solicitudes. Intente más tarde' } }),
  });

  // Público (el solicitante aún no tiene cuenta) pero limitado por tasa.
  router.post('/', limiter, validate(crearSolicitudSchema), async (req, res) => {
    res.status(201).json(await service.crear(req.body, req.ip));
  });
  return router;
}
