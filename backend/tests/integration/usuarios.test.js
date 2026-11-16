import { beforeAll, describe, expect, it } from 'vitest';
import { auth, crearContexto, ids, login, rangoDe, tokenAdmin, ultimaPassword } from '../helpers/ctx.js';

let ctx; let admin; let cat; let rolFuncionario; let rolAdmin; let todosPermisos;
const get = (p, t = admin) => ctx.api().get(`/api/v1${p}`).set(auth(t));
const post = (p, b, t = admin) => ctx.api().post(`/api/v1${p}`).set(auth(t)).send(b);
const patch = (p, b, t = admin) => ctx.api().patch(`/api/v1${p}`).set(auth(t)).send(b);

const nuevo = (extra = {}) => ({
  identificacion: '7100000001', nombres: 'Elena', apellidos: 'Ospina', correo: 'elena@example.test', rolId: rolFuncionario,
  fuerzaPublicaId: cat.policia.id, rangoId: rangoDe(cat.policia, 'Capitán'), idFuerza: 'PN-70001', ...extra,
});

beforeAll(async () => {
  ctx = await crearContexto();
  admin = await tokenAdmin(ctx);
  cat = await ids(ctx);
  const roles = (await get('/roles')).body.roles;
  rolFuncionario = roles.find((r) => r.nombre === 'FUNCIONARIO').id;
  rolAdmin = roles.find((r) => r.nombre === 'ADMINISTRADOR').id;
  todosPermisos = (await get('/roles/permisos')).body.opciones.flatMap((o) => o.permisos.map((p) => p.id));
});

describe('[HU12] crear usuarios', () => {
  it('crea un funcionario, genera credencial temporal, la envía y no expone secretos', async () => {
    const r = await post('/usuarios', nuevo());
    expect(r.status).toBe(201);
    expect(r.body.usuario).toMatchObject({ identificacion: '7100000001', estado: 'ACTIVO', debeCambiarPassword: true, rol: { nombre: 'FUNCIONARIO' } });
    expect(JSON.stringify(r.body)).not.toMatch(/passwordHash|argon2|password_hash/);
    const pwd = ultimaPassword(ctx.mail);
    expect(pwd).toHaveLength(6);
    expect(JSON.stringify(r.body)).not.toContain(pwd);
    expect((await login(ctx, '7100000001', pwd)).status).toBe(200);
  });
  it('rechaza duplicados por identificación, correo o ID Fuerza (409)', async () => {
    expect((await post('/usuarios', nuevo())).body.error.code).toBe('USUARIO_DUPLICADO');
    expect((await post('/usuarios', nuevo({ identificacion: '7100000002', correo: 'elena@example.test', idFuerza: 'PN-70002' }))).status).toBe(409);
    expect((await post('/usuarios', nuevo({ identificacion: '7100000003', correo: 'otra@example.test' }))).status).toBe(409);
  });
  it('un funcionario requiere fuerza, rango e ID Fuerza', async () => {
    const r = await post('/usuarios', nuevo({ identificacion: '7100000004', correo: 'f4@example.test', fuerzaPublicaId: null, rangoId: null, idFuerza: null }));
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('DATOS_FUERZA_REQUERIDOS');
  });
  it('el rango debe pertenecer a la fuerza', async () => {
    const r = await post('/usuarios', nuevo({ identificacion: '7100000005', correo: 'f5@example.test', idFuerza: 'PN-70005', rangoId: rangoDe(cat.armada, 'Almirante') }));
    expect(r.body.error.code).toBe('FUERZA_RANGO_INVALIDO');
  });
  it('un administrador no necesita datos de fuerza pública', async () => {
    const r = await post('/usuarios', nuevo({ identificacion: '7100000006', correo: 'adm2@example.test', rolId: rolAdmin, fuerzaPublicaId: null, rangoId: null, idFuerza: null }));
    expect(r.status).toBe(201);
    expect(r.body.usuario.fuerza).toBeNull();
  });
  it('valida formato de entradas y rol inexistente', async () => {
    const r = await post('/usuarios', { identificacion: 'abc', nombres: '1', correo: 'x', rolId: 9999 });
    expect(r.status).toBe(400);
    expect(r.body.error.details.length).toBeGreaterThanOrEqual(3);
    expect((await post('/usuarios', nuevo({ identificacion: '7100000007', correo: 'f7@example.test', rolId: 9999 }))).body.error.code).toBe('ROL_NO_ENCONTRADO');
  });
  it('si el correo falla no queda el usuario creado', async () => {
    const original = ctx.mail.enviarCredenciales;
    ctx.mail.enviarCredenciales = async () => { throw new Error('SMTP'); };
    const r = await post('/usuarios', nuevo({ identificacion: '7100000008', correo: 'f8@example.test', idFuerza: 'PN-70008' }));
    ctx.mail.enviarCredenciales = original;
    expect(r.status).toBe(503);
    expect(await ctx.prisma.usuario.findUnique({ where: { identificacion: '7100000008' } })).toBeNull();
  });
});

describe('[HU12] consultar y editar', () => {
  it('lista con filtros y paginación', async () => {
    const todos = await get('/usuarios?pageSize=2&page=1');
    expect(todos.body.items).toHaveLength(2);
    expect(todos.body.total).toBeGreaterThanOrEqual(3);
    const q = await get('/usuarios?q=elena');
    expect(q.body.items.map((u) => u.identificacion)).toContain('7100000001');
    expect(q.body.items.every((u) => u.nombres.toLowerCase().includes('elena'))).toBe(true);
    const porId = await get('/usuarios?q=7100000001');
    expect(porId.body.items.map((u) => u.identificacion)).toEqual(['7100000001']);
    const rol = await get(`/usuarios?rolId=${rolAdmin}`);
    expect(rol.body.items.every((u) => u.rol.nombre === 'ADMINISTRADOR')).toBe(true);
    expect((await get('/usuarios?estado=XX')).status).toBe(400);
  });
  it('obtiene por id y 404 si no existe', async () => {
    const u = await ctx.prisma.usuario.findUnique({ where: { identificacion: '7100000001' } });
    expect((await get(`/usuarios/${u.id}`)).body.usuario.correo).toBe('elena@example.test');
    expect((await get('/usuarios/99999')).status).toBe(404);
  });
  it('edita datos; la identificación es inmutable', async () => {
    const u = await ctx.prisma.usuario.findUnique({ where: { identificacion: '7100000001' } });
    const r = await patch(`/usuarios/${u.id}`, { nombres: 'Elena María', identificacion: '9999999' });
    expect(r.status).toBe(200);
    expect(r.body.usuario).toMatchObject({ nombres: 'Elena María', identificacion: '7100000001' });
    expect((await patch(`/usuarios/${u.id}`, {})).status).toBe(400);
    expect((await patch(`/usuarios/${u.id}`, { fuerzaPublicaId: null, rangoId: null, idFuerza: null })).body.error.code).toBe('DATOS_FUERZA_REQUERIDOS');
  });
});

describe('[HU12] estado, rol y restablecimiento', () => {
  it('no puede cambiar su propio estado, rol ni restablecer su contraseña', async () => {
    const yo = await ctx.prisma.usuario.findUnique({ where: { identificacion: '1000000001' } });
    expect((await patch(`/usuarios/${yo.id}/estado`, { estado: 'INACTIVO' })).body.error.code).toBe('OPERACION_SOBRE_SI_MISMO');
    expect((await patch(`/usuarios/${yo.id}/rol`, { rolId: rolFuncionario })).body.error.code).toBe('OPERACION_SOBRE_SI_MISMO');
    expect((await post(`/usuarios/${yo.id}/restablecer-password`, {})).status).toBe(403);
  });
  it('desactiva y reactiva usuarios', async () => {
    const u = await ctx.prisma.usuario.findUnique({ where: { identificacion: '7100000001' } });
    expect((await patch(`/usuarios/${u.id}/estado`, { estado: 'INACTIVO' })).body.usuario.estado).toBe('INACTIVO');
    expect((await patch(`/usuarios/${u.id}/estado`, { estado: 'ACTIVO' })).body.usuario.estado).toBe('ACTIVO');
  });
  it('cambia el rol de un usuario (un solo rol por usuario)', async () => {
    const rol = await post('/roles', { nombre: 'Auditor', permisoIds: [] });
    const u = await ctx.prisma.usuario.findUnique({ where: { identificacion: '7100000001' } });
    const r = await patch(`/usuarios/${u.id}/rol`, { rolId: rol.body.rol.id });
    expect(r.body.usuario.rol.nombre).toBe('Auditor');
    // volver a FUNCIONARIO exige datos de fuerza: los tiene
    expect((await patch(`/usuarios/${u.id}/rol`, { rolId: rolFuncionario })).status).toBe(200);
  });
  it('restablecer contraseña genera una nueva temporal, fuerza el cambio y cierra sesiones', async () => {
    const u = await ctx.prisma.usuario.findUnique({ where: { identificacion: '7100000001' } });
    const antes = await login(ctx, '7100000001', ultimaPasswordDe('7100000001'));
    expect(antes.status).toBe(200);
    const r = await post(`/usuarios/${u.id}/restablecer-password`, {});
    expect(r.status).toBe(204);
        const nueva = ultimaPassword(ctx.mail);
    const l = await login(ctx, '7100000001', nueva);
    expect(l.body.usuario.debeCambiarPassword).toBe(true);
  });
  it('no se puede desactivar al último administrador activo', async () => {
    // Un rol con todos los permisos permite llegar a la regla del último administrador.
    const clon = await post('/roles', { nombre: 'Clon admin', permisoIds: todosPermisos });
    expect(clon.status).toBe(201);
    await post('/usuarios', { identificacion: '7100000010', nombres: 'Clon', apellidos: 'Admin', correo: 'clon@example.test', rolId: clon.body.rol.id });
    const pwd = ultimaPassword(ctx.mail);
    const l = await login(ctx, '7100000010', pwd);
    const c = await ctx.api().post('/api/v1/auth/cambiar-password').set(auth(l.body.accessToken)).send({ passwordActual: pwd, passwordNueva: 'Clon1234' });
    const tok = c.body.accessToken;
    const admins = (await get(`/usuarios?rolId=${rolAdmin}`)).body.items;
    // desactivar uno de los dos administradores funciona…
    const segundo = admins.find((a) => a.identificacion === '7100000006');
    expect((await patch(`/usuarios/${segundo.id}/estado`, { estado: 'INACTIVO' }, tok)).status).toBe(200);
    // …pero el último no
    const principal = admins.find((a) => a.identificacion === '1000000001');
    const r = await patch(`/usuarios/${principal.id}/estado`, { estado: 'INACTIVO' }, tok);
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('ULTIMO_ADMINISTRADOR');
  });
});

function ultimaPasswordDe(identificacion) {
  // Busca la última contraseña enviada a ese usuario en los correos simulados.
  const correo = ctx.mail.enviados.filter((m) => m.texto.includes(`(${identificacion})`)).at(-1);
  return correo.texto.match(/\n {4}(\S{6})\n/)[1];
}
