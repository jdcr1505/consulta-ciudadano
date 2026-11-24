import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearContexto } from '../helpers/ctx.js';

let dir; let ctx; let sinWeb;

beforeAll(async () => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'web-dist-'));
  mkdirSync(path.join(dir, 'assets'));
  writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>Web de prueba</title><div id="root"></div>');
  writeFileSync(path.join(dir, 'assets', 'app-abc123.js'), 'console.log("ok")');
  ctx = await crearContexto({ env: { WEB_DIST_DIR: dir } });
  sinWeb = await crearContexto({ env: { WEB_DIST_DIR: path.join(dir, 'no-existe') } });
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('despliegue: la web compilada se sirve desde el mismo origen que la API', () => {
  it('GET / devuelve index.html sin caché', async () => {
    const r = await ctx.api().get('/');
    expect(r.status).toBe(200);
    expect(r.text).toContain('Web de prueba');
    expect(r.headers['cache-control']).toBe('no-cache');
  });
  it('las rutas de React Router (/ciudadanos, /roles…) devuelven index.html', async () => {
    for (const ruta of ['/ciudadanos', '/inicio', '/roles']) {
      const r = await ctx.api().get(ruta);
      expect(r.status).toBe(200);
      expect(r.text).toContain('Web de prueba');
    }
  });
  it('los archivos con hash de /assets se cachean un año', async () => {
    const r = await ctx.api().get('/assets/app-abc123.js');
    expect(r.status).toBe(200);
    expect(r.headers['cache-control']).toContain('immutable');
  });
  it('la API sigue funcionando y una ruta de API inexistente NO devuelve index.html', async () => {
    expect((await ctx.api().get('/api/v1/health')).body).toEqual({ estado: 'ok' });
    const r = await ctx.api().get('/api/v1/no-existe');
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe('RUTA_NO_ENCONTRADA');
  });
  it('envía una política de seguridad de contenido (CSP)', async () => {
    const r = await ctx.api().get('/');
    expect(r.headers['content-security-policy']).toContain("default-src 'self'");
  });
  it('sin carpeta de la web compilada, / responde 404 JSON (solo API)', async () => {
    const r = await sinWeb.api().get('/');
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe('RUTA_NO_ENCONTRADA');
  });
});

describe('configuración de producción', () => {
  it('rechaza arrancar en producción con el correo simulado', async () => {
    const { loadConfig } = await import('../../src/config/env.js');
    expect(() => loadConfig({ ...process.env, NODE_ENV: 'production', MAIL_MODE: 'dev' })).toThrow(/MAIL_MODE=dev/);
  });
  it('en producción confía en 1 salto de proxy por defecto y se puede ajustar', async () => {
    const { loadConfig } = await import('../../src/config/env.js');
    expect(loadConfig({ ...process.env, NODE_ENV: 'production', MAIL_MODE: 'smtp' }).trustProxy).toBe(1);
    expect(loadConfig({ ...process.env, NODE_ENV: 'production', MAIL_MODE: 'smtp', TRUST_PROXY: '2' }).trustProxy).toBe(2);
    expect(loadConfig({ ...process.env }).trustProxy).toBe(0);
  });
  it('la CSP de producción incluye upgrade-insecure-requests; la de desarrollo no', async () => {
    const dev = await ctx.api().get('/');
    expect(dev.headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
    const prod = await crearContexto({ env: { WEB_DIST_DIR: dir, NODE_ENV: 'production', MAIL_MODE: 'smtp' } });
    const r = await prod.api().get('/');
    expect(r.headers['content-security-policy']).toContain('upgrade-insecure-requests');
    await prod.prisma.$disconnect();
  });
});
