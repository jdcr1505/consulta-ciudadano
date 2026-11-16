import { beforeAll, describe, expect, it } from 'vitest';
import { auth, crearContexto, login, tokenAdmin } from '../helpers/ctx.js';

let ctx; let admin; let permisos; let porCodigo;
const get = (p, t = admin) => ctx.api().get(`/api/v1${p}`).set(auth(t));
const post = (p, b, t = admin) => ctx.api().post(`/api/v1${p}`).set(auth(t)).send(b);
const patch = (p, b, t = admin) => ctx.api().patch(`/api/v1${p}`).set(auth(t)).send(b);
const put = (p, b, t = admin) => ctx.api().put(`/api/v1${p}`).set(auth(t)).send(b);
const del = (p, t = admin) => ctx.api().delete(`/api/v1${p}`).set(auth(t));

beforeAll(async () => {
  ctx = await crearContexto();
  admin = await tokenAdmin(ctx);
  const cat = await get('/roles/permisos');
  permisos = cat.body.opciones.flatMap((o) => o.permisos);
  porCodigo = Object.fromEntries(permisos.map((p) => [p.codigo, p.id]));
});

describe('[HU13] catálogo y consulta de roles', () => {
  it('el catálogo agrupa los permisos por opción (opción × acción)', async () => {
    const r = await get('/roles/permisos');
    expect(r.status).toBe(200);
    const roles = r.body.opciones.find((o) => o.codigo === 'roles');
    expect(roles.permisos.map((p) => p.accion)).toEqual(['leer', 'crear', 'editar', 'eliminar']);
  });
  it('lista los roles base con su número de usuarios y permisos', async () => {
    const r = await get('/roles');
    const nombres = r.body.roles.map((x) => x.nombre);
    expect(nombres).toEqual(expect.arrayContaining(['ADMINISTRADOR', 'FUNCIONARIO']));
    expect(r.body.roles.find((x) => x.nombre === 'ADMINISTRADOR')).toMatchObject({ esBase: true, usuarios: 1, permisos: permisos.length });
  });
  it('rol inexistente → 404', async () => {
    expect((await get('/roles/9999')).status).toBe(404);
    expect((await get('/roles/abc')).status).toBe(400);
  });
});

describe('[HU13] crear, editar y eliminar roles', () => {
  let rolId;
  it('crea un rol con permisos y lo devuelve con detalle', async () => {
    const r = await post('/roles', { nombre: 'Supervisor', descripcion: 'Solo lectura de ciudadanos', permisoIds: [porCodigo['ciudadanos:leer']] });
    expect(r.status).toBe(201);
    expect(r.body.rol.permisos.map((p) => p.codigo)).toEqual(['ciudadanos:leer']);
    expect(r.body.rol.esBase).toBe(false);
    rolId = r.body.rol.id;
  });
  it('rechaza nombre duplicado sin distinguir mayúsculas (409)', async () => {
    const r = await post('/roles', { nombre: 'SUPERVISOR', permisoIds: [] });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('ROL_DUPLICADO');
  });
  it('valida nombre y permisos inexistentes', async () => {
    expect((await post('/roles', { nombre: 'a', permisoIds: [] })).status).toBe(400);
    expect((await post('/roles', { nombre: 'Con permiso falso', permisoIds: [99999] })).body.error.code).toBe('PERMISO_NO_ENCONTRADO');
  });
  it('edita nombre y descripción de un rol propio; no permite renombrar roles base', async () => {
    const r = await patch(`/roles/${rolId}`, { nombre: 'Supervisor Jr', descripcion: null });
    expect(r.status).toBe(200);
    expect(r.body.rol).toMatchObject({ nombre: 'Supervisor Jr', descripcion: null });
    const base = await get('/roles');
    const func = base.body.roles.find((x) => x.nombre === 'FUNCIONARIO');
    const ren = await patch(`/roles/${func.id}`, { nombre: 'OTRO' });
    expect(ren.status).toBe(403);
    expect(ren.body.error.code).toBe('ROL_BASE');
  });
  it('reemplaza los permisos del rol (PUT) y quita los no incluidos', async () => {
    const r = await put(`/roles/${rolId}/permisos`, { permisoIds: [porCodigo['ciudadanos:leer'], porCodigo['usuarios:leer']] });
    expect(r.status).toBe(200);
    expect(r.body.rol.permisos.map((p) => p.codigo).sort()).toEqual(['ciudadanos:leer', 'usuarios:leer']);
    const r2 = await put(`/roles/${rolId}/permisos`, { permisoIds: [] });
    expect(r2.body.rol.permisos).toEqual([]);
  });
  it('no permite modificar los permisos del rol ADMINISTRADOR (protegido)', async () => {
    const lista = await get('/roles');
    const adm = lista.body.roles.find((x) => x.nombre === 'ADMINISTRADOR');
    const r = await put(`/roles/${adm.id}/permisos`, { permisoIds: [] });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('ROL_PROTEGIDO');
  });
  it('no permite eliminar roles base ni roles con usuarios; sí uno sin uso', async () => {
    const lista = await get('/roles');
    const func = lista.body.roles.find((x) => x.nombre === 'FUNCIONARIO');
    expect((await del(`/roles/${func.id}`)).body.error.code).toBe('ROL_BASE');
    const usado = await post('/roles', { nombre: 'Rol en uso', permisoIds: [] });
    await post('/usuarios', { identificacion: '7000000001', nombres: 'Pedro', apellidos: 'Prueba', correo: 'pedro@example.test', rolId: usado.body.rol.id });
    const bloqueado = await del(`/roles/${usado.body.rol.id}`);
    expect(bloqueado.status).toBe(409);
    expect(bloqueado.body.error.code).toBe('ROL_EN_USO');
    expect((await del(`/roles/${rolId}`)).status).toBe(204);
    expect((await get(`/roles/${rolId}`)).status).toBe(404);
  });
});

describe('[HU13][HU12] control de escalada de privilegios', () => {
  let gestor; // usuario con rol limitado
  beforeAll(async () => {
    const r = await post('/roles', {
      nombre: 'Gestor de seguridad',
      permisoIds: ['roles:leer', 'roles:crear', 'roles:editar', 'usuarios:leer', 'usuarios:crear', 'usuarios:editar'].map((c) => porCodigo[c]),
    });
    await post('/usuarios', { identificacion: '7000000002', nombres: 'Gina', apellidos: 'Gestora', correo: 'gina@example.test', rolId: r.body.rol.id });
    const pwd = ctx.mail.enviados.at(-1).texto.match(/\n {4}(\S{6})\n/)[1];
    const l = await login(ctx, '7000000002', pwd);
    const c = await ctx.api().post('/api/v1/auth/cambiar-password').set(auth(l.body.accessToken)).send({ passwordActual: pwd, passwordNueva: 'Gestora1' });
    gestor = c.body.accessToken;
  });

  it('no puede crear un rol con permisos que no posee', async () => {
    const r = await post('/roles', { nombre: 'Rol ambicioso', permisoIds: [porCodigo['ciudadanos:editar']] }, gestor);
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('ESCALADA_PRIVILEGIOS');
  });
  it('sí puede crear un rol con permisos que posee', async () => {
    const r = await post('/roles', { nombre: 'Rol permitido', permisoIds: [porCodigo['usuarios:leer']] }, gestor);
    expect(r.status).toBe(201);
  });
  it('no puede agregar permisos que no posee a un rol existente', async () => {
    const lista = await get('/roles');
    const func = lista.body.roles.find((x) => x.nombre === 'FUNCIONARIO');
    const r = await put(`/roles/${func.id}/permisos`, { permisoIds: [porCodigo['consultas:crear'], porCodigo['ciudadanos:editar']] }, gestor);
    expect(r.status).toBe(403);
  });
  it('no puede crear un usuario con el rol ADMINISTRADOR (privilegios superiores)', async () => {
    const lista = await get('/roles');
    const adm = lista.body.roles.find((x) => x.nombre === 'ADMINISTRADOR');
    const r = await post('/usuarios', { identificacion: '7000000003', nombres: 'Paco', apellidos: 'Pillo', correo: 'paco@example.test', rolId: adm.id }, gestor);
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('ESCALADA_PRIVILEGIOS');
    expect(await ctx.prisma.usuario.findUnique({ where: { identificacion: '7000000003' } })).toBeNull();
  });
  it('no puede modificar ni desactivar a un administrador', async () => {
    const adm = await ctx.prisma.usuario.findUnique({ where: { identificacion: '1000000001' } });
    expect((await patch(`/usuarios/${adm.id}/estado`, { estado: 'INACTIVO' }, gestor)).status).toBe(403);
    expect((await patch(`/usuarios/${adm.id}`, { nombres: 'Hackeado' }, gestor)).status).toBe(403);
    expect((await ctx.api().post(`/api/v1/usuarios/${adm.id}/restablecer-password`).set(auth(gestor))).status).toBe(403);
  });
});
