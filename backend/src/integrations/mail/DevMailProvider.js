import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { plantillaCredenciales } from './MailProvider.js';

/**
 * MODO DESARROLLO: NO envía correos reales. Guarda el mensaje en ./dev-outbox y en memoria
 * para poder probar el flujo. La contraseña no se escribe en la consola.
 */
export class DevMailProvider {
  constructor(dir = path.resolve('dev-outbox'), { persist = true } = {}) {
    this.dir = dir;
    this.persist = persist;
    this.simulado = true;
    this.enviados = [];
  }

  async enviarCredenciales(datos) {
    const { asunto, texto } = plantillaCredenciales(datos);
    const mensaje = { fecha: new Date().toISOString(), para: datos.para, asunto, texto };
    this.enviados.push(mensaje);
    if (this.enviados.length > 50) this.enviados.shift();
    if (this.persist) {
      await mkdir(this.dir, { recursive: true });
      await writeFile(path.join(this.dir, `${Date.now()}-${datos.identificacion}.json`), JSON.stringify(mensaje, null, 2), 'utf8');
    }
  }
}
