import { defineConfig } from "prisma/config";

// Las migraciones deben usar la conexión DIRECTA (en Neon, la dirección SIN "-pooler"): DIRECT_URL.
// La aplicación usa DATABASE_URL (en Neon, la dirección CON "-pooler") a través del adaptador pg.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "node --env-file-if-exists=.env prisma/seed.js" },
  datasource: { url: process.env.DIRECT_URL || process.env.DATABASE_URL },
});
