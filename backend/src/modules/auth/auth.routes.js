import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../../common/validate.js';
import { cambiarPasswordSchema, loginSchema } from './auth.schemas.js';

const COOKIE = 'rt';

export function createAuthRouter({ cfg, service, authenticate }) {
  const router = Router();

  const limiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => !cfg.rateLimitEnabled,
    handler: (_req, res) =>
      res.status(429).json({ error: { code: 'DEMASIADAS_PETICIONES', message: 'Demasiadas peticiones. Intente más tarde' } }),
  });

  const esMovil = (req) => req.get('x-client-type') === 'mobile';
  const cookieOpts = {
    httpOnly: true,
    sameSite: 'strict',
    secure: cfg.isProduction,
    path: '/api/v1/auth',
    maxAge: cfg.refreshTokenHours * 3600_000,
  };

  // Web: el refresh token viaja en cookie httpOnly. Móvil: en el cuerpo (se guarda en almacenamiento seguro).
  function responder(req, res, sesion, status = 200) {
    const { refreshToken, ...resto } = sesion;
    if (esMovil(req)) return res.status(status).json({ ...resto, refreshToken });
    res.cookie(COOKIE, refreshToken, cookieOpts);
    return res.status(status).json(resto);
  }

  router.post('/login', limiter, validate(loginSchema), async (req, res) => {
    const sesion = await service.login(req.body, req.ip);
    responder(req, res, sesion);
  });

  router.post('/refresh', limiter, async (req, res) => {
    const token = esMovil(req) ? req.body?.refreshToken : req.cookies?.[COOKIE];
    const sesion = await service.refresh(token, req.ip);
    responder(req, res, sesion);
  });

  router.post('/logout', authenticate, async (req, res) => {
    const token = esMovil(req) ? req.body?.refreshToken : req.cookies?.[COOKIE];
    await service.logout(token, req.user.id, req.ip);
    res.clearCookie(COOKIE, { ...cookieOpts, maxAge: undefined });
    res.status(204).end();
  });

  router.get('/me', authenticate, async (req, res) => {
    res.json({ usuario: await service.me(req.user.id) });
  });

  router.post('/cambiar-password', authenticate, validate(cambiarPasswordSchema), async (req, res) => {
    const sesion = await service.cambiarPassword(req.user.id, req.body, req.ip);
    responder(req, res, sesion);
  });

  return router;
}
