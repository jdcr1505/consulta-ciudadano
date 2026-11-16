import { loadConfig } from './config/env.js';
import { createPrisma } from './db.js';
import { TesseractMrzOcr } from './integrations/ocr/TesseractMrzOcr.js';
import { SimDefensaProvider } from './integrations/defensa/SimDefensaProvider.js';
import { DevMailProvider } from './integrations/mail/DevMailProvider.js';
import { SmtpMailProvider } from './integrations/mail/SmtpMailProvider.js';
import { createApp } from './app.js';

const cfg = loadConfig();
const prisma = createPrisma(cfg.databaseUrl);
const mail = cfg.mailMode === 'smtp' ? new SmtpMailProvider(cfg) : new DevMailProvider();
const defensa = new SimDefensaProvider(prisma); // SIMULACIÓN: sustituir por un proveedor real autorizado

const ocr = new TesseractMrzOcr(); // el motor se inicia solo al primer uso
const app = createApp({ prisma, cfg, defensa, mail, ocr });
const server = app.listen(cfg.port, () => {
  console.log(`API escuchando en http://localhost:${cfg.port}/api/v1  (correo: ${mail.simulado ? 'SIMULADO' : 'SMTP'}, defensa: SIMULADA)`);
});

const cerrar = async () => {
  server.close();
  await ocr.cerrar();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', cerrar);
process.on('SIGTERM', cerrar);
