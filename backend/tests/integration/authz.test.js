import { beforeAll, describe, expect, it } from 'vitest';
import { auth, crearContexto, ids, login, rangoDe, ultimaPassword } from '../helpers/ctx.js';

let ctx; let func;

// Todos los endpoints protegidos del Sprint 1 y el método con el que se prueban.
const PROTEGIDOS = [
  ['get', '/usuarios'], ['post', '/usuarios'], ['get', '/usuarios/1'], ['patch', '/usuarios/1'], ['patch', '/usuarios/1/estado'],
  ['patch', '/usuarios/1/rol'], ['post', '/usuarios/1/restablecer-password'],
  ['get', '/roles/permisos'], ['post', '/roles'], ['patch', '/roles/1'], ['put', '/roles/1/permisos'], ['delete', '/roles/1'],
  ['get', '/ciudadanos'], ['post', '/ciudadanos'], ['get', '/ciudadanos/1'], ['patch', '/ciudadanos/1'], ['patch', '/ciudadanos/1/activo'],
  ['get', '/auth/me'],
];

beforeAll(async () => {
  ctx = await crearContexto();
  const cat = await ids(ctx);
  await ctx.api().post('/api/v1/solicitudes').send({
    identificacion: '1050607080', nombres: 'Diana Marcela', apellidos: 'Ortiz León',
    fuerzaPublicaId: cat.fuerzas.find((f) => f.nombre === 'Fuerza Aérea').id,
    rangoId: rangoDe(cat.fuerzas.find((f) => f.nombre === 'Fuerza Aérea'), 'Teniente'), idFuerza: 'FA-20418', correo: 'diana@example.test',
  });
  const pwd = ultimaPassword(ctx.mail);
  const l = await login(ctx, '1050607080', pwd);
  const c = await ctx.api().post('/api/v1/auth/cambiar-password').set(auth(l.body.accessToken)).send({ passwordActual: pwd, passwordNueva: 'Diana123' });
  func = c.body.accessToken;
});

describe('[HU03][HU12][HU13][HU14] acceso no autorizado', () => {
  it.each(PROTEGIDOS)('%s %s sin token → 401', async (metodo, ruta) => {
    const r = await ctx.api()[metodo](`/api/v1${ruta}`).send({});
    expect(r.status).toBe(401);
  });

  it.each(PROTEGIDOS.filter(([, r]) => r !== '/auth/me'))('%s %s con rol FUNCIONARIO → 403 (autorización en el servidor)', async (metodo, ruta) => {
    const r = await ctx.api()[metodo](`/api/v1${ruta}`).set(auth(func)).send({});
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('SIN_PERMISO');
  });

  it('el funcionario sí puede ver su propia sesión, con sus permisos', async () => {
    const r = await ctx.api().get('/api/v1/auth/me').set(auth(func));
    expect(r.status).toBe(200);
    expect(r.body.usuario.rol).toBe('FUNCIONARIO');
    expect(r.body.usuario.permisos).toEqual(['consultas:crear', 'consultas:leer', 'novedades:crear', 'novedades:leer_propias']);
  });

  it('un cambio de permisos en el rol se aplica de inmediato (permisos leídos de BD en cada petición)', async () => {
    const p = await ctx.prisma.permiso.findUnique({ where: { codigo: 'ciudadanos:leer' } });
    const rol = await ctx.prisma.rol.findUnique({ where: { nombre: 'FUNCIONARIO' } });
    await ctx.prisma.rolPermiso.create({ data: { rolId: rol.id, permisoId: p.id } });
    expect((await ctx.api().get('/api/v1/ciudadanos').set(auth(func))).status).toBe(200);
    await ctx.prisma.rolPermiso.delete({ where: { rolId_permisoId: { rolId: rol.id, permisoId: p.id } } });
    expect((await ctx.api().get('/api/v1/ciudadanos').set(auth(func))).status).toBe(403);
  });
});

describe('manejo de errores y cabeceras de seguridad', () => {
  it('ruta inexistente → 404 con formato uniforme', async () => {
    const r = await ctx.api().get('/api/v1/no-existe');
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe('RUTA_NO_ENCONTRADA');
  });
  it('JSON malformado → 400 sin filtrar detalles internos', async () => {
    const r = await ctx.api().post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{"mal"');
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('JSON_INVALIDO');
  });
  it('envía cabeceras de helmet y no revela Express', async () => {
    const r = await ctx.api().get('/api/v1/health');
    expect(r.headers['x-powered-by']).toBeUndefined();
    expect(r.headers['x-content-type-options']).toBe('nosniff');
  });
  it('CORS solo permite los orígenes configurados', async () => {
    const ok = await ctx.api().get('/api/v1/health').set('Origin', 'http://localhost:5173');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const no = await ctx.api().get('/api/v1/health').set('Origin', 'http://malicioso.test');
    expect(no.headers['access-control-allow-origin']).toBeUndefined();
  });
  it('/info declara las simulaciones activas', async () => {
    const r = await ctx.api().get('/api/v1/info');
    expect(r.body.simulaciones).toEqual({ datos: true, defensa: true, correo: true });
  });
});
