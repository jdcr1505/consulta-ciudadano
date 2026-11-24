// Lectura y validación de configuración. Los secretos vienen solo de variables de entorno.
import path from 'node:path';

const num = (v, d) => (v === undefined || v === '' ? d : Number(v));

export function loadConfig(env = process.env) {
  const cfg = {
    nodeEnv: env.NODE_ENV ?? 'development',
    port: num(env.PORT, 4000),
    databaseUrl: env.DATABASE_URL,
    jwtAccessSecret: env.JWT_ACCESS_SECRET,
    accessTokenMinutes: num(env.ACCESS_TOKEN_MINUTES, 15),
    refreshTokenHours: num(env.REFRESH_TOKEN_HOURS, 12),
    corsOrigins: (env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
    tempPasswordHours: num(env.TEMP_PASSWORD_HOURS, 24),
    maxLoginAttempts: num(env.MAX_LOGIN_ATTEMPTS, 5),
    lockMinutes: num(env.LOCK_MINUTES, 15),
    mailMode: env.MAIL_MODE ?? 'dev',
    mailFrom: env.MAIL_FROM ?? 'no-reply@example.test',
    smtp: { host: env.SMTP_HOST, port: num(env.SMTP_PORT, 587), user: env.SMTP_USER, pass: env.SMTP_PASS },
    rateLimitEnabled: env.RATE_LIMIT_ENABLED !== 'false',
    // Carpeta con la web compilada (web/dist). Si existe, el backend la sirve en el mismo origen que la API.
    webDistDir: env.WEB_DIST_DIR ?? path.resolve('../web/dist'),
    // Saltos de proxy de confianza (en producción, detrás del proxy de la plataforma: 1).
    trustProxy: num(env.TRUST_PROXY, env.NODE_ENV === 'production' ? 1 : 0),
    // Pool de conexiones a la base de datos (Neon suspende la BD tras un rato sin uso: la primera conexión puede tardar).
    dbPoolMax: num(env.DB_POOL_MAX, 10),
    dbConnectTimeoutMs: num(env.DB_CONNECT_TIMEOUT_MS, 20000),
  };
  cfg.isProduction = cfg.nodeEnv === 'production';

  if (!cfg.databaseUrl) throw new Error('Falta DATABASE_URL');
  if (!cfg.jwtAccessSecret || cfg.jwtAccessSecret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET es obligatorio y debe tener al menos 32 caracteres');
  }
  if (cfg.isProduction && cfg.mailMode === 'dev') {
    throw new Error('MAIL_MODE=dev (correo simulado) no está permitido en producción');
  }
  return cfg;
}
