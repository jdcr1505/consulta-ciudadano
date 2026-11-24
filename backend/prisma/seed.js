import { createPrisma } from '../src/db.js';
import { seedBase, seedDemo } from './seed-lib.js';

const prisma = createPrisma(process.env.DATABASE_URL);
try {
  await seedBase(prisma);
  // En producción los datos ficticios (incluida la fuente SIMULADA de Defensa) solo se cargan si se pide: SEED_DEMO=true
  const demo = process.env.NODE_ENV !== 'production' || process.env.SEED_DEMO === 'true';
  if (demo) await seedDemo(prisma);
  console.log('Seed completado' + (demo ? ' (incluye datos FICTICIOS de demostración)' : ' (sin datos de demostración)'));
} finally {
  await prisma.$disconnect();
}
