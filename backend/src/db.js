import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Cliente Prisma sobre el adaptador `pg`. Pensado también para bases serverless como Neon, que cierran las
 * conexiones inactivas y se "duermen": se limita el pool, se da margen a la primera conexión y los cierres de
 * conexiones inactivas se registran como aviso en lugar de tumbar el proceso.
 */
export function createPrisma(databaseUrl, { max = 10, connectionTimeoutMillis = 20000, logger = console } = {}) {
  const adapter = new PrismaPg(
    { connectionString: databaseUrl, max, connectionTimeoutMillis, idleTimeoutMillis: 30000, keepAlive: true },
    {
      onPoolError: (e) => logger.warn('Aviso de base de datos (conexión inactiva cerrada):', e.message),
      onConnectionError: (e) => logger.warn('Aviso de base de datos (error de conexión):', e.message),
    },
  );
  return new PrismaClient({ adapter });
}
