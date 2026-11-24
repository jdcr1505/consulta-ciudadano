import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { forbidden } from '../../common/errors.js';
import { paginacion } from '../../common/fields.js';
import { validate } from '../../common/validate.js';
import { authorize } from '../../security/authenticate.js';

const crearConsultaSchema = {
  body: z.object({
    identificacion: z.union([z.string(), z.number()], { error: 'La identificación es obligatoria' }).transform(String),
    origen: z.enum(['ESCANER', 'MANUAL'], { error: 'Origen inválido' }).default('MANUAL'),
  }),
};

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use el formato AAAA-MM-DD').refine((v) => !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime()), 'Fecha inválida');

const listarConsultasSchema = {
  query: z.object({
    resultado: z.enum(['REQUERIDO', 'NO_REQUERIDO', 'NO_REGISTRADO'], { error: 'Resultado inválido' }).optional(),
    desde: fechaIso.optional(),
    hasta: fechaIso.optional(),
    identificacion: z.string().trim().regex(/^[0-9]{1,10}$/, 'Identificación inválida').optional(),
    usuarioId: z.coerce.number().int().positive().optional(),
    ...paginacion,
  }),
};

export function createConsultasRouter({ cfg, service, audit }) {
  const router = Router();
  // Limita las consultas por funcionario para dificultar la extracción masiva de datos.
  const limiter = rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => !cfg.rateLimitEnabled,
    keyGenerator: (req) => `u${req.user.id}`,
    handler: (_req, res) => res.status(429).json({ error: { code: 'DEMASIADAS_PETICIONES', message: 'Demasiadas consultas por minuto. Espere un momento' } }),
  });

  const autorizar = async (req, _res, next) => {
    if (req.user.permisos.has('consultas:crear')) return next();
    await audit.registrar({ usuarioId: req.user.id, accion: 'CONSULTA', resultado: 'NO_AUTORIZADO', ip: req.ip }).catch(() => {});
    next(forbidden('CONSULTA_NO_AUTORIZADA', 'No está autorizado para realizar consultas'));
  };

  router.post('/', autorizar, limiter, validate(crearConsultaSchema), async (req, res) => {
    res.status(200).json(await service.consultar(req.user, req.body, req.ip));
  });

  // HU07 — Historial: el funcionario ve las suyas; con consultas:leer_todas se ven todas.
  router.get('/', authorize('consultas:leer', 'consultas:leer_todas'), validate(listarConsultasSchema), async (req, res) => {
    res.json(await service.listar(req.user, req.validQuery, req.ip));
  });
  return router;
}