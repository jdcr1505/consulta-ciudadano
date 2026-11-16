import { createPrisma } from '../src/db.js';
import { seedBase, seedDemo } from './seed-lib.js';

const prisma = createPrisma(process.env.DATABASE_URL);
try {
  await seedBase(prisma);
  if (process.env.NODE_ENV !== 'production') await seedDemo(prisma);
  console.log('Seed completado' + (process.env.NODE_ENV === 'production' ? ' (sin datos de demostración)' : ' (incluye datos FICTICIOS de demostración)'));
} finally {
  await prisma.$disconnect();
}
