import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../../common/validate.js';
import { authorize } from '../../security/authenticate.js';
import { crearSolicitudSchema, idSolicitudSchema, listarSolicitudesSchema, rechazarSolicitudSchema } from './solicitudes.schemas.js';

export function createSolicitudesRouter({ cfg, service, authenticate }) {
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

  // HU01 — Público (el solicitante aún no tiene cuenta) pero limitado por tasa.
  router.post('/', limiter, validate(crearSolicitudSchema), async (req, res) => {
    res.status(201).json(await service.crear(req.body, req.ip));
  });

  // HU10 y HU11 — Administración: requieren sesión y permiso en el servidor.
  router.get('/', authenticate, authorize('solicitudes:leer'), validate(listarSolicitudesSchema), async (req, res) => {
    res.json(await service.listar(req.validQuery));
  });
  router.get('/:id', authenticate, authorize('solicitudes:leer'), validate(idSolicitudSchema), async (req, res) => {
    res.json({ solicitud: await service.obtener(req.params.id) });
  });
  router.post('/:id/aprobar', authenticate, authorize('solicitudes:resolver'), validate(idSolicitudSchema), async (req, res) => {
    res.json({ solicitud: await service.aprobar(req.user, req.params.id, req.ip) });
  });
  router.post('/:id/rechazar', authenticate, authorize('solicitudes:resolver'), validate(rechazarSolicitudSchema), async (req, res) => {
    res.json({ solicitud: await service.rechazar(req.user, req.params.id, req.body, req.ip) });
  });
  return router;
}