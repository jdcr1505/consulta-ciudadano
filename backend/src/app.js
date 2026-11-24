import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { errorHandler, notFoundHandler } from './common/errors.js';
import { authenticate } from './security/authenticate.js';
import { createAuditService } from './modules/auditoria/auditoria.service.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createAuthService } from './modules/auth/auth.service.js';
import { createCatalogosRouter } from './modules/catalogos/catalogos.routes.js';
import { createConsultasRouter } from './modules/consultas/consultas.routes.js';
import { createConsultasService } from './modules/consultas/consultas.service.js';
import { createDocumentosRouter } from './modules/documentos/documentos.routes.js';
import { createDocumentosService } from './modules/documentos/documentos.service.js';
import { createReportesRouter } from './modules/reportes/reportes.routes.js';
import { createReportesService } from './modules/reportes/reportes.service.js';
import { createResumenRouter } from './modules/resumen/resumen.routes.js';
import { createCiudadanosRouter } from './modules/ciudadanos/ciudadanos.routes.js';
import { createCiudadanosService } from './modules/ciudadanos/ciudadanos.service.js';
import { createNovedadesRouter } from './modules/novedades/novedades.routes.js';
import { createNovedadesService } from './modules/novedades/novedades.service.js';
import { createRolesRouter } from './modules/roles/roles.routes.js';
import { createRolesService } from './modules/roles/roles.service.js';
import { createSolicitudesRouter } from './modules/solicitudes/solicitudes.routes.js';
import { createSolicitudesService } from './modules/solicitudes/solicitudes.service.js';
import { createUsuariosRouter } from './modules/usuarios/usuarios.routes.js';
import { createUsuariosService } from './modules/usuarios/usuarios.service.js';

/**
 * Composición de la aplicación. Las integraciones externas (defensa, correo) se inyectan:
 * hoy son SIMULACIONES identificadas; se reemplazan por implementaciones reales sin tocar los servicios.
 */
export function createApp({ prisma, cfg, defensa, mail, ocr = null, logger = console }) {
  const app = express();
  app.disable('x-powered-by');
  // Detrás del proxy de la plataforma (HTTPS) hace falta confiar en él para ver la IP real del cliente.
  if (cfg.trustProxy) app.set('trust proxy', cfg.trustProxy);
  // 'upgrade-insecure-requests' solo en producción (HTTPS); en local rompería la carga por http://localhost.
  app.use(helmet({ contentSecurityPolicy: { useDefaults: true, directives: { 'upgrade-insecure-requests': cfg.isProduction ? [] : null } } }));
  app.use(cors({ origin: cfg.corsOrigins, credentials: true }));
  // Las fotografías de la MRZ (base64) necesitan un límite mayor; el resto de la API se mantiene en 100 kB.
  app.use('/api/v1/documentos', express.json({ limit: '4mb' }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const audit = createAuditService(prisma);
  const auth = authenticate({ prisma, cfg });
  const api = express.Router();

  api.get('/health', (_req, res) => res.json({ estado: 'ok' }));
  // Transparencia (RNF-09): la interfaz muestra que el sistema es académico y qué fuentes son simuladas.
  api.get('/info', (_req, res) =>
    res.json({
      sistema: 'Sistema de Consulta Ciudadano (proyecto académico, datos ficticios)',
      simulaciones: { datos: true, defensa: Boolean(defensa.simulado), correo: Boolean(mail.simulado) },
    }),
  );

  api.use('/auth', createAuthRouter({ cfg, authenticate: auth, service: createAuthService({ prisma, cfg, audit }) }));
  api.use('/catalogos', createCatalogosRouter({ prisma }));
  api.use('/solicitudes', createSolicitudesRouter({ cfg, authenticate: auth, service: createSolicitudesService({ prisma, cfg, defensa, mail, audit }) }));

  // Todo lo que sigue requiere sesión autenticada.
  api.use('/usuarios', auth, createUsuariosRouter({ service: createUsuariosService({ prisma, cfg, mail, audit }) }));
  api.use('/roles', auth, createRolesRouter({ service: createRolesService({ prisma, audit }) }));
  api.use('/ciudadanos', auth, createCiudadanosRouter({ service: createCiudadanosService({ prisma, audit }) }));

  api.use('/consultas', auth, createConsultasRouter({ cfg, audit, service: createConsultasService({ prisma, audit }) }));
  api.use('/documentos', auth, createDocumentosRouter({ cfg, service: createDocumentosService({ ocr, audit }) }));
  api.use('/reportes', auth, createReportesRouter({ service: createReportesService({ prisma, audit }) }));
  api.use('/resumen', auth, createResumenRouter({ prisma }));
  api.use('/novedades', auth, createNovedadesRouter({ service: createNovedadesService({ prisma, audit }) }));

  // Solo modo desarrollo (MAIL_MODE=dev, prohibido en producción): ver los correos simulados.
  if (mail.simulado && Array.isArray(mail.enviados)) {
    api.get('/dev/outbox', (_req, res) => res.json({ aviso: 'MODO DESARROLLO: correos simulados, no se envió nada real', correos: [...mail.enviados].reverse() }));
  }

  app.use('/api/v1', api);

  // Web compilada (web/dist) en el mismo origen que la API: sin CORS y con la cookie de sesión funcionando.
  const indexWeb = path.join(cfg.webDistDir, 'index.html');
  if (fs.existsSync(indexWeb)) {
    app.use(
      express.static(cfg.webDistDir, {
        index: false,
        setHeaders: (res, archivo) => {
          // Los archivos de /assets llevan hash en el nombre: se pueden cachear para siempre.
          res.setHeader('Cache-Control', archivo.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
        },
      }),
    );
    // Rutas de la web (React Router): cualquier GET que no sea de la API devuelve index.html.
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(indexWeb);
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler(logger));
  return app;
}