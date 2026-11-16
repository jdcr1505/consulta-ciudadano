// Lectura y validación de configuración. Los secretos vienen solo de variables de entorno.
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
