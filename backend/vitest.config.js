import { defineConfig } from 'vitest/config';

// Las pruebas usan una base de datos APARTE (nombre terminado en _test) que se reinicia en cada archivo.
export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    include: ['tests/**/*.test.js'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://consulta:consulta_dev@localhost:5432/consulta_ciudadano_test',
      JWT_ACCESS_SECRET: 'secreto-solo-para-pruebas-0123456789abcdef',
      RATE_LIMIT_ENABLED: 'false',
      MAIL_MODE: 'dev',
      MAX_LOGIN_ATTEMPTS: '3',
      TEMP_PASSWORD_HOURS: '24',
      ADMIN_IDENTIFICACION: '1000000001',
      ADMIN_INITIAL_PASSWORD: 'Admin1',
    },
  },
});
